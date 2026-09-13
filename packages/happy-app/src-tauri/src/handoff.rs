//! What the app hands the daemon (DESK-08, DESK-12, DESK-21).
//!
//! The app and the daemon keep their own state in their own places: the app has
//! the relay address it was given and the account it logged into, the daemon reads
//! `~/.happy/`. Nothing used to cross that gap, so a package with no relay baked in
//! left the daemon refusing to start, and the user's own computer never joined
//! their account.
//!
//! Both commands here run the daemon's own executable and let it write its own
//! files: the relay address goes through the daemon's locked settings writer, the
//! account through the same login request a second computer uses. This shell never
//! edits either file, and never handles the account key.
//!
//! The model gateway goes the same way, with one difference that matters: its
//! request travels on the daemon's stdin, never in argv. The platform API key is
//! one of its fields, and an argument is readable in any process list on the
//! machine. The daemon writes its own credential store and replies with which
//! fields are set, never with what they are set to.
//!
//! The login request carries a one-time token the app minted. The daemon echoes it
//! back, this shell refuses a reply that does not carry it, and the app checks it
//! again before approving — so the app can only ever approve the login request of
//! the sidecar it just asked for, never one some other process published.

use std::collections::HashMap;
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tauri::async_runtime::Receiver;

use crate::daemon::{DaemonProcess, DAEMON_SIDECAR};

const HANDOFF_LINE_PREFIX: &str = "happy-handoff ";
const LOGIN_TOKEN_VARIABLE: &str = "HAPPY_DAEMON_LOGIN_TOKEN";
/// The daemon answers in one round trip; anything slower is a daemon that is not answering.
const REPLY_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Serialize)]
pub struct RelayHandoff {
    pub status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformCredentialsHandoff {
    pub status: String,
    /// Which gateway fields the computer holds. Booleans: never the values.
    pub set: Value,
    /// The machine this daemon registers as, so the app can find it in the machine list.
    pub machine_id: Option<String>,
}

#[derive(Serialize)]
pub struct LoginHandoff {
    pub status: String,
    /// The login request to approve, present only while one is awaiting approval.
    pub url: Option<String>,
    /// The one-time token, echoed by the daemon for the app to check again.
    pub token: Option<String>,
}

#[tauri::command]
pub async fn set_daemon_relay(app: AppHandle, url: String) -> Result<RelayHandoff, String> {
    let (mut events, _child) = spawn_handoff(&app, &["daemon", "set-relay", &url], None)?;
    let reply = first_reply(&mut events).await?;
    let status = field(&reply, "status").ok_or("the daemon did not say what it did")?;

    if status == "refused" {
        let reason = field(&reply, "reason").unwrap_or_else(|| "unknown".to_string());
        return Err(format!("the daemon refused the relay address: {reason}"));
    }
    if status == "updated" {
        app.state::<DaemonProcess>().request_restart();
    }
    Ok(RelayHandoff { status })
}

#[tauri::command]
pub async fn request_daemon_login(app: AppHandle, token: String) -> Result<LoginHandoff, String> {
    let mut environment = HashMap::new();
    environment.insert(LOGIN_TOKEN_VARIABLE.to_string(), token.clone());

    let (mut events, _child) = spawn_handoff(&app, &["daemon", "login-request"], Some(environment))?;
    let reply = first_reply(&mut events).await?;

    if field(&reply, "token").as_deref() != Some(token.as_str()) {
        return Err("the login request did not come from the daemon this app started".to_string());
    }
    let status = field(&reply, "status").ok_or("the daemon did not say what it did")?;
    if status == "refused" {
        let reason = field(&reply, "reason").unwrap_or_else(|| "unknown".to_string());
        return Err(format!("the daemon refused to publish a login request: {reason}"));
    }

    let url = field(&reply, "url");
    if status == "awaiting-approval" {
        if url.is_none() {
            return Err("the daemon published no login request to approve".to_string());
        }
        // The daemon stays up waiting for the approval the app is about to give; the
        // restart happens once it reports credentials, so the next daemon finds them.
        watch_for_login(app.clone(), events, token.clone());
    }

    Ok(LoginHandoff {
        status,
        url,
        token: Some(token),
    })
}

/// Sets or reads this computer's model gateway (DESK-12).
///
/// `request` is the JSON object the account page built — any subset of `apiKey`,
/// `baseUrl` and `modelId`, or `{}` to read the state without changing it. It is
/// written to the daemon's stdin and stdin is then closed, so the daemon sees the
/// whole request and one end of it. No part of it is ever an argument.
///
/// The daemon does not have to be restarted afterwards: a session reads the
/// credential store when it spawns its engine, so the next agent started on this
/// computer gets the new gateway.
#[tauri::command]
pub async fn set_platform_credentials(
    app: AppHandle,
    request: String,
) -> Result<PlatformCredentialsHandoff, String> {
    let (mut events, mut child) =
        spawn_handoff(&app, &["daemon", "set-platform-credentials"], None)?;
    let written = child
        .write(request.as_bytes())
        .and_then(|_| child.write(b"\n"))
        .map_err(|error| format!("could not hand the model gateway to the daemon: {error}"));
    // Dropping the child closes its stdin, which is the end of the request the
    // daemon is waiting for; the process itself runs on and answers.
    drop(child);
    written?;

    let reply = first_reply(&mut events).await?;
    let status = field(&reply, "status").ok_or("the daemon did not say what it did")?;
    if status == "refused" {
        let reason = field(&reply, "reason").unwrap_or_else(|| "unknown".to_string());
        return Err(format!("the daemon refused the model gateway: {reason}"));
    }

    let set = reply
        .get("set")
        .filter(|value| value.is_object())
        .cloned()
        .ok_or("the daemon did not say which model gateway fields it holds")?;

    Ok(PlatformCredentialsHandoff {
        status,
        set,
        machine_id: field(&reply, "machineId"),
    })
}

type HandoffOutput = (Receiver<CommandEvent>, tauri_plugin_shell::process::CommandChild);

fn spawn_handoff(
    app: &AppHandle,
    args: &[&str],
    environment: Option<HashMap<String, String>>,
) -> Result<HandoffOutput, String> {
    let mut command = app
        .shell()
        .sidecar(DAEMON_SIDECAR)
        .map_err(|error| format!("no daemon is installed with this app: {error}"))?
        .args(args);
    if let Some(environment) = environment {
        command = command.envs(environment);
    }
    command
        .spawn()
        .map_err(|error| format!("could not run the daemon: {error}"))
}

async fn first_reply(events: &mut Receiver<CommandEvent>) -> Result<Value, String> {
    let deadline = tokio::time::Instant::now() + REPLY_TIMEOUT;
    loop {
        let event = tokio::time::timeout_at(deadline, events.recv())
            .await
            .map_err(|_| "the daemon did not answer".to_string())?;
        match event {
            Some(CommandEvent::Stdout(line)) => {
                if let Some(reply) = parse_reply(&line) {
                    return Ok(reply);
                }
            }
            Some(CommandEvent::Stderr(line)) => {
                log::info!("daemon: {}", String::from_utf8_lossy(&line).trim_end());
            }
            Some(CommandEvent::Terminated(status)) => {
                return Err(format!("the daemon exited with {:?}", status.code));
            }
            None => return Err("the daemon said nothing at all".to_string()),
            _ => {}
        }
    }
}

/// Restarts the daemon once the login it is waiting for has been approved.
fn watch_for_login(app: AppHandle, mut events: Receiver<CommandEvent>, token: String) {
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let Some(reply) = parse_reply(&line) else { continue };
                    if field(&reply, "token").as_deref() != Some(token.as_str()) {
                        continue;
                    }
                    match field(&reply, "status").as_deref() {
                        Some("authenticated") => {
                            log::info!("this computer is on the account; restarting the daemon");
                            app.state::<DaemonProcess>().request_restart();
                            return;
                        }
                        Some(other) => {
                            log::warn!("the login request ended as {other}");
                            return;
                        }
                        None => {}
                    }
                }
                CommandEvent::Stderr(line) => {
                    log::info!("daemon: {}", String::from_utf8_lossy(&line).trim_end());
                }
                CommandEvent::Terminated(status) => {
                    log::info!("the login request ended with {:?}", status.code);
                    return;
                }
                _ => {}
            }
        }
    });
}

fn parse_reply(line: &[u8]) -> Option<Value> {
    let text = String::from_utf8_lossy(line);
    let body = text.trim().strip_prefix(HANDOFF_LINE_PREFIX)?;
    serde_json::from_str(body).ok()
}

fn field(reply: &Value, name: &str) -> Option<String> {
    reply.get(name)?.as_str().map(str::to_string)
}

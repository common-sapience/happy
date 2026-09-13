//! The desktop install owns the daemon process (DESK-09, HOST-01).
//!
//! The daemon is shipped as a sidecar next to the app executable, together with
//! the engine it starts; it finds the engine by looking beside itself, so no path
//! is configured here. Before the user has an account the daemon exits instead of
//! asking a terminal nobody is watching, so the supervisor keeps trying until the
//! app closes.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const DAEMON_SIDECAR: &str = "happy-daemon";
const FIRST_RETRY_DELAY: Duration = Duration::from_secs(5);
const LONGEST_RETRY_DELAY: Duration = Duration::from_secs(60);
/// A daemon that stayed up this long was doing its job, so the next restart is prompt again.
const HEALTHY_RUN: Duration = Duration::from_secs(60);

#[derive(Default)]
pub struct DaemonProcess(Mutex<Option<CommandChild>>);

impl DaemonProcess {
    fn replace(&self, child: Option<CommandChild>) {
        if let Ok(mut slot) = self.0.lock() {
            *slot = child;
        }
    }

    pub fn stop(&self) {
        if let Ok(mut slot) = self.0.lock() {
            if let Some(child) = slot.take() {
                if let Err(error) = child.kill() {
                    log::warn!("could not stop the daemon: {error}");
                }
            }
        }
    }
}

pub fn supervise(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut delay = FIRST_RETRY_DELAY;
        loop {
            let started = Instant::now();
            run_until_exit(&app).await;
            delay = if started.elapsed() >= HEALTHY_RUN {
                FIRST_RETRY_DELAY
            } else {
                (delay * 2).min(LONGEST_RETRY_DELAY)
            };
            tokio::time::sleep(delay).await;
        }
    });
}

async fn run_until_exit(app: &AppHandle) {
    let mut command = match app.shell().sidecar(DAEMON_SIDECAR) {
        Ok(command) => command.args(["daemon", "start-sync", "--only-if-authenticated"]),
        Err(error) => {
            log::error!("no daemon is installed with this app: {error}");
            return;
        }
    };

    if let Some(server_url) = option_env!("HAPPY_SERVER_URL").filter(|url| !url.is_empty()) {
        command = command.env("HAPPY_SERVER_URL", server_url);
    }

    let (mut events, child) = match command.spawn() {
        Ok(started) => started,
        Err(error) => {
            log::error!("could not start the daemon: {error}");
            return;
        }
    };

    let state = app.state::<DaemonProcess>();
    state.replace(Some(child));

    while let Some(event) = events.recv().await {
        match event {
            CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                log::info!("daemon: {}", String::from_utf8_lossy(&line).trim_end());
            }
            CommandEvent::Terminated(status) => {
                log::info!("daemon exited with {:?}", status.code);
                break;
            }
            _ => {}
        }
    }

    app.state::<DaemonProcess>().replace(None);
}

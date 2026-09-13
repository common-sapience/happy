//! The desktop install owns the daemon process (DESK-09, DESK-21, HOST-01).
//!
//! The daemon is shipped as a sidecar next to the app executable, together with
//! the engine it starts; it finds the engine by looking beside itself, so no path
//! is configured here. Before the user has an account the daemon exits instead of
//! asking a terminal nobody is watching, so the supervisor keeps trying until the
//! app closes.
//!
//! Nothing about the relay is compiled in here. The app resolves which relay this
//! install uses — the address it was built with, or the one the user entered — and
//! hands that address to the daemon (see `handoff.rs`), so the two sides can never
//! disagree about which server this computer belongs to.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::Notify;

pub const DAEMON_SIDECAR: &str = "happy-daemon";
const FIRST_RETRY_DELAY: Duration = Duration::from_secs(5);
const LONGEST_RETRY_DELAY: Duration = Duration::from_secs(60);
/// A daemon that stayed up this long was doing its job, so the next restart is prompt again.
const HEALTHY_RUN: Duration = Duration::from_secs(60);

#[derive(Default)]
pub struct DaemonProcess {
    child: Mutex<Option<CommandChild>>,
    restart: Notify,
}

impl DaemonProcess {
    fn replace(&self, child: Option<CommandChild>) {
        if let Ok(mut slot) = self.child.lock() {
            *slot = child;
        }
    }

    pub fn stop(&self) {
        if let Ok(mut slot) = self.child.lock() {
            if let Some(child) = slot.take() {
                if let Err(error) = child.kill() {
                    log::warn!("could not stop the daemon: {error}");
                }
            }
        }
    }

    /// Ends this daemon and has the supervisor start the next one without waiting
    /// out the backoff: what it reads at startup — the relay address, the account —
    /// has just changed, and a daemon that missed the change is the whole bug.
    pub fn request_restart(&self) {
        self.stop();
        self.restart.notify_one();
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
            let restart = {
                let state = app.state::<DaemonProcess>();
                tokio::select! {
                    _ = tokio::time::sleep(delay) => false,
                    _ = state.restart.notified() => true,
                }
            };
            if restart {
                delay = FIRST_RETRY_DELAY;
            }
        }
    });
}

async fn run_until_exit(app: &AppHandle) {
    let command = match app.shell().sidecar(DAEMON_SIDECAR) {
        Ok(command) => command.args(["daemon", "start-sync", "--only-if-authenticated"]),
        Err(error) => {
            log::error!("no daemon is installed with this app: {error}");
            return;
        }
    };

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

fn main() {
  // The relay the shell hands the daemon is baked in at build time, so a change
  // of relay has to recompile.
  println!("cargo:rerun-if-env-changed=HAPPY_SERVER_URL");
  tauri_build::build()
}

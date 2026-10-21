use std::ffi::OsString;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct LaunchArguments {
    pub files: Vec<String>,
    pub new_document: bool,
}

// Windows y Linux entregan asociaciones de archivo y aperturas desde terminal
// como argumentos del proceso. La segunda instancia entrega además su cwd, de
// modo que una ruta relativa conserve el significado de quien la invocó.
pub fn parse_launch_arguments<I, S>(args: I, cwd: &Path) -> LaunchArguments
where
    I: IntoIterator<Item = S>,
    S: Into<OsString>,
{
    let mut request = LaunchArguments::default();
    let mut positional_only = false;

    for raw in args.into_iter().skip(1).map(Into::into) {
        let value = raw.to_string_lossy();
        if !positional_only && value == "--" {
            positional_only = true;
            continue;
        }
        if !positional_only && value == "--new" {
            request.new_document = true;
            continue;
        }
        if !positional_only && value.starts_with('-') {
            continue;
        }
        if value.contains("://") {
            continue;
        }

        let path = PathBuf::from(raw);
        let absolute = if path.is_absolute() {
            path
        } else {
            cwd.join(path)
        };
        request.files.push(absolute.to_string_lossy().into_owned());
    }

    request
}

pub fn requested_information<I, S>(args: I) -> Option<&'static str>
where
    I: IntoIterator<Item = S>,
    S: Into<OsString>,
{
    for raw in args.into_iter().skip(1).map(Into::into) {
        match raw.to_string_lossy().as_ref() {
            "-h" | "--help" => return Some("help"),
            "-V" | "--version" => return Some("version"),
            _ => {}
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::{parse_launch_arguments, requested_information, LaunchArguments};
    use std::ffi::OsString;
    use std::path::Path;

    fn args(values: &[&str]) -> Vec<OsString> {
        values.iter().map(OsString::from).collect()
    }

    #[test]
    fn takes_all_plain_file_paths_and_resolves_relatives() {
        assert_eq!(
            parse_launch_arguments(
                args(&["luca", "/tmp/uno.md", "dos.md", "tres con espacios.md"]),
                Path::new("/work")
            ),
            LaunchArguments {
                files: vec![
                    "/tmp/uno.md".into(),
                    "/work/dos.md".into(),
                    "/work/tres con espacios.md".into(),
                ],
                new_document: false,
            }
        );
    }

    #[test]
    fn recognises_new_and_ignores_unknown_flags_and_urls() {
        assert_eq!(
            parse_launch_arguments(
                args(&[
                    "luca",
                    "--new",
                    "--verbose",
                    "https://example.test/no-es-un-archivo",
                    "/tmp/pagina.md",
                ]),
                Path::new("/work")
            ),
            LaunchArguments {
                files: vec!["/tmp/pagina.md".into()],
                new_document: true,
            }
        );
    }

    #[test]
    fn double_dash_allows_a_file_that_begins_with_dash() {
        assert_eq!(
            parse_launch_arguments(args(&["luca", "--", "-borrador.md"]), Path::new("/work")).files,
            vec!["/work/-borrador.md"]
        );
    }

    #[test]
    fn recognises_help_and_version() {
        assert_eq!(
            requested_information(args(&["luca", "--help"])),
            Some("help")
        );
        assert_eq!(
            requested_information(args(&["luca", "-V"])),
            Some("version")
        );
        assert_eq!(requested_information(args(&["luca", "archivo.md"])), None);
    }
}

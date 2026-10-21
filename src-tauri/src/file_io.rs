pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|error| error.to_string())
}

pub fn write_text_file(path: String, contents: String) -> Result<u64, String> {
    let temporary = format!("{path}.luca-tmp");
    std::fs::write(&temporary, contents.as_bytes()).map_err(|error| error.to_string())?;
    std::fs::rename(&temporary, &path).map_err(|error| error.to_string())?;
    mtime_ms(&path)
}

pub fn mtime_ms(path: &str) -> Result<u64, String> {
    let modified = std::fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .map_err(|error| error.to_string())?;
    modified
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{read_text_file, write_text_file};
    use std::path::Path;

    #[test]
    fn wikitext_real_hace_round_trip_byte_fiel_con_bom_y_crlf() {
        let fixture = include_str!("../../tests/fixtures/wikitext-complejo.wiki");
        let source = format!("\u{feff}{}", fixture.replace('\n', "\r\n"));
        let path = std::env::temp_dir().join(format!(
            "luca-wikitext-{}-{}.wiki",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let path_string = path.to_string_lossy().into_owned();

        write_text_file(path_string.clone(), source.clone()).unwrap();
        let result = read_text_file(path_string).unwrap();

        assert_eq!(result.as_bytes(), source.as_bytes());
        assert!(result.starts_with('\u{feff}'));
        assert!(result.contains("\r\n{{Ficha desconocida"));
        assert!(result.contains("<extension-rara atributo=\"áéíóú\">"));
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn lectura_informa_utf8_invalido_sin_reescribir_el_archivo() {
        let path = std::env::temp_dir().join(format!("luca-invalid-{}.wiki", std::process::id()));
        let original = [0xff, 0xfe, b'L'];
        std::fs::write(&path, original).unwrap();

        let result = read_text_file(path.to_string_lossy().into_owned());

        assert!(result.is_err());
        assert_eq!(std::fs::read(&path).unwrap(), original);
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn reemplazo_no_deja_el_temporal() {
        let path = std::env::temp_dir().join(format!("luca-atomic-{}.wiki", std::process::id()));
        let path_string = path.to_string_lossy().into_owned();
        write_text_file(path_string.clone(), "primero".into()).unwrap();
        write_text_file(path_string.clone(), "después".into()).unwrap();

        assert_eq!(std::fs::read_to_string(&path).unwrap(), "después");
        assert!(!Path::new(&format!("{path_string}.luca-tmp")).exists());
        std::fs::remove_file(path).unwrap();
    }
}

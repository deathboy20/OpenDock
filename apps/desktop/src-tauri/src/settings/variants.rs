//! Ways a widget can draw the same data. Reads the same catalog as
//! `packages/config-schema/src/variants.ts`.

use std::collections::BTreeMap;
use std::sync::OnceLock;

const VARIANTS_JSON: &str =
    include_str!("../../../../../packages/config-schema/src/widget-variants.json");

fn catalog() -> &'static BTreeMap<String, Vec<String>> {
    static CATALOG: OnceLock<BTreeMap<String, Vec<String>>> = OnceLock::new();
    CATALOG.get_or_init(|| {
        let raw: BTreeMap<String, serde_json::Value> =
            serde_json::from_str(VARIANTS_JSON).expect("widget-variants.json is valid");
        raw.into_iter()
            .filter(|(key, _)| !key.starts_with('$'))
            .filter_map(|(key, value)| Some((key, serde_json::from_value(value).ok()?)))
            .collect()
    })
}

pub fn is_valid_variant(widget: &str, variant: &str) -> bool {
    catalog()
        .get(widget)
        .is_some_and(|list| list.iter().any(|v| v == variant))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_shared_catalog() {
        assert!(is_valid_variant("battery", "dots"));
        assert!(is_valid_variant("clock", "analog"));
        assert!(!is_valid_variant("battery", "analog"));
        assert!(!is_valid_variant("projects", "ring"));
        assert!(!is_valid_variant("$comment", "x"));
    }
}

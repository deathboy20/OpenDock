//! Skins: packs of design-token overrides. Mirrors `packages/config-schema/src/skins.ts` and
//! reads the same token list, so both languages accept exactly the same skins. A skin can only
//! set listed tokens to values of the right kind; it can never carry CSS, URLs or scripts.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const MAX_CUSTOM_SKINS: usize = 20;

const TOKENS_JSON: &str =
    include_str!("../../../../../packages/config-schema/src/skin-tokens.json");
const BUILTINS_JSON: &str =
    include_str!("../../../../../packages/config-schema/src/builtin-skins.json");

#[derive(Debug, Deserialize)]
struct TokenSpec {
    kind: String,
    #[serde(default)]
    max: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct TokenCatalog {
    tokens: BTreeMap<String, TokenSpec>,
    fonts: BTreeMap<String, String>,
    shadows: BTreeMap<String, String>,
}

fn catalog() -> &'static TokenCatalog {
    static CATALOG: OnceLock<TokenCatalog> = OnceLock::new();
    CATALOG.get_or_init(|| serde_json::from_str(TOKENS_JSON).expect("skin-tokens.json is valid"))
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Skin {
    pub format: String,
    pub version: u32,
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub dark: BTreeMap<String, Value>,
    #[serde(default)]
    pub light: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct SkinSettings {
    /// A built-in or custom skin id. `None` means the dock style's own tokens.
    pub active: Option<String>,
    pub custom: Vec<Skin>,
}

pub fn builtin_ids() -> &'static [String] {
    static IDS: OnceLock<Vec<String>> = OnceLock::new();
    IDS.get_or_init(|| {
        let skins: Vec<Skin> =
            serde_json::from_str(BUILTINS_JSON).expect("builtin-skins.json is valid");
        skins.into_iter().map(|s| s.id).collect()
    })
}

pub fn is_valid_skin_id(id: &str) -> bool {
    let bytes = id.as_bytes();
    (1..=40).contains(&bytes.len())
        && bytes
            .iter()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || *b == b'-')
        && bytes[0] != b'-'
        && bytes[bytes.len() - 1] != b'-'
}

/// `#rrggbb`, `#rrggbbaa`, or `rgba(r, g, b, a)` with channels 0-255 and alpha 0-1.
pub fn is_skin_color(value: &str) -> bool {
    if let Some(hex) = value.strip_prefix('#') {
        return matches!(hex.len(), 6 | 8) && hex.chars().all(|c| c.is_ascii_hexdigit());
    }
    let Some(inner) = value
        .strip_prefix("rgba(")
        .and_then(|v| v.strip_suffix(')'))
    else {
        return false;
    };
    let parts: Vec<&str> = inner.split(',').map(str::trim).collect();
    if parts.len() != 4 {
        return false;
    }
    let channels_ok = parts[..3]
        .iter()
        .all(|p| (1..=3).contains(&p.len()) && p.parse::<u16>().is_ok_and(|n| n <= 255));
    let alpha = parts[3];
    let alpha_ok = match alpha {
        "0" | "1" => true,
        _ => {
            let digits = alpha
                .strip_prefix("1.")
                .map(|d| (d, true))
                .or_else(|| alpha.strip_prefix("0.").map(|d| (d, false)))
                .or_else(|| alpha.strip_prefix('.').map(|d| (d, false)));
            match digits {
                Some((d, one)) => {
                    (1..=3).contains(&d.len())
                        && d.chars().all(|c| c.is_ascii_digit())
                        && (!one || d.chars().all(|c| c == '0'))
                }
                None => false,
            }
        }
    };
    channels_ok && alpha_ok
}

pub fn is_valid_value(token: &str, value: &Value) -> bool {
    let catalog = catalog();
    let Some(spec) = catalog.tokens.get(token) else {
        return false;
    };
    match spec.kind.as_str() {
        "color" => value
            .as_str()
            .is_some_and(|v| v.len() <= 40 && is_skin_color(v)),
        "length" | "duration" => value.as_u64().is_some_and(|n| n <= spec.max.unwrap_or(0)),
        "font" => value
            .as_str()
            .is_some_and(|v| catalog.fonts.contains_key(v)),
        "shadow" => value
            .as_str()
            .is_some_and(|v| catalog.shadows.contains_key(v)),
        _ => false,
    }
}

impl Skin {
    pub fn validate(&self) -> Result<(), String> {
        if self.format != "opendock-skin" || self.version != 1 {
            return Err("not an OpenDock skin (format opendock-skin, version 1)".into());
        }
        if !is_valid_skin_id(&self.id) {
            return Err(format!("invalid skin id: {}", self.id));
        }
        let name = self.name.trim();
        if name.is_empty() || name.chars().count() > 40 {
            return Err("skin names must be 1-40 characters".into());
        }
        if self.description.chars().count() > 160 {
            return Err("skin descriptions must be at most 160 characters".into());
        }
        for (token, value) in self.dark.iter().chain(self.light.iter()) {
            if !is_valid_value(token, value) {
                return Err(format!("{token} has a value a skin can't use"));
            }
        }
        Ok(())
    }
}

impl SkinSettings {
    pub fn validate(&self) -> Result<(), String> {
        if self.custom.len() > MAX_CUSTOM_SKINS {
            return Err(format!("at most {MAX_CUSTOM_SKINS} custom skins"));
        }
        let builtins = builtin_ids();
        for (index, skin) in self.custom.iter().enumerate() {
            skin.validate()?;
            if builtins.contains(&skin.id) {
                return Err("a custom skin uses a built-in skin's id".into());
            }
            if self.custom[..index].iter().any(|s| s.id == skin.id) {
                return Err("two skins share an id".into());
            }
        }
        if let Some(active) = &self.active {
            let exists = builtins.contains(active) || self.custom.iter().any(|s| &s.id == active);
            if !exists {
                return Err("the active skin doesn't exist".into());
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn built_in_skins_are_valid() {
        let skins: Vec<Skin> = serde_json::from_str(BUILTINS_JSON).unwrap();
        assert_eq!(skins.len(), 5);
        for skin in &skins {
            skin.validate()
                .unwrap_or_else(|e| panic!("{}: {e}", skin.id));
        }
        assert!(builtin_ids().contains(&"graphite".to_string()));
    }

    #[test]
    fn accepts_only_safe_colours() {
        for ok in [
            "#7cf2c8",
            "#7CF2C8AA",
            "rgba(0, 0, 0, 0.5)",
            "rgba(255,255,255,1)",
            "rgba(1, 2, 3, .25)",
        ] {
            assert!(is_skin_color(ok), "{ok}");
        }
        for bad in [
            "red",
            "#fff",
            "rgba(256, 0, 0, 1)",
            "rgba(0, 0, 0, 1.5)",
            "rgb(0, 0, 0)",
            "url(https://x.y/a.png)",
            "var(--od-text)",
            "#000000; background: url(x)",
            "expression(alert(1))",
        ] {
            assert!(!is_skin_color(bad), "{bad}");
        }
    }

    #[test]
    fn checks_each_token_kind() {
        assert!(is_valid_value("radiusSm", &json!(8)));
        assert!(!is_valid_value("radiusSm", &json!(99)));
        assert!(!is_valid_value("radiusSm", &json!(-1)));
        assert!(!is_valid_value("radiusSm", &json!(4.5)));
        assert!(!is_valid_value("radiusSm", &json!("8px")));
        assert!(is_valid_value("font", &json!("segoe")));
        assert!(!is_valid_value("font", &json!("Comic Sans MS")));
        assert!(is_valid_value("shadow", &json!("none")));
        assert!(is_valid_value("motionFast", &json!(80)));
        assert!(!is_valid_value("motionFast", &json!(5000)));
        assert!(!is_valid_value("background-image", &json!("#000000")));
    }

    #[test]
    fn checks_skin_settings() {
        let skin = |id: &str| Skin {
            format: "opendock-skin".into(),
            version: 1,
            id: id.into(),
            name: "Mine".into(),
            description: String::new(),
            dark: BTreeMap::from([("accent".to_string(), json!("#ff8800"))]),
            light: BTreeMap::new(),
        };
        let ok = SkinSettings {
            active: Some("mine".into()),
            custom: vec![skin("mine")],
        };
        ok.validate().unwrap();
        assert!(SkinSettings {
            active: Some("graphite".into()),
            custom: vec![]
        }
        .validate()
        .is_ok());
        assert!(SkinSettings {
            active: Some("missing".into()),
            custom: vec![]
        }
        .validate()
        .is_err());
        assert!(SkinSettings {
            active: None,
            custom: vec![skin("graphite")]
        }
        .validate()
        .is_err());
        assert!(SkinSettings {
            active: None,
            custom: vec![skin("a"), skin("a")]
        }
        .validate()
        .is_err());
        assert!(!is_valid_skin_id("-bad"));
        assert!(!is_valid_skin_id("Bad"));
    }
}

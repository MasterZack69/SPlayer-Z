use super::*;

#[test]
fn pipewire_props_includes_stable_identity_and_optional_rate() {
    let props_with_rate = format_pipewire_props(96000);
    assert!(props_with_rate.contains(r#""node.latency":"1024/48000""#));
    assert!(props_with_rate.contains(r#""node.rate":"1/96000""#));
    assert!(props_with_rate.contains(r#""application.id":"io.github.MasterZack69.SPlayerZ""#));
    assert!(props_with_rate.contains(r#""application.name":"SPlayer-Z""#));
    assert!(props_with_rate.contains(r#""application.icon-name":"splayer-z""#));
    assert!(props_with_rate.contains(r#""media.name":"Playback""#));

    let props_without_rate = format_pipewire_props(0);
    assert!(!props_without_rate.contains("node.rate"));
    assert!(props_without_rate.contains(r#""application.id":"io.github.MasterZack69.SPlayerZ""#));
    assert!(props_without_rate.contains(r#""application.name":"SPlayer-Z""#));
    assert!(props_without_rate.contains(r#""application.icon-name":"splayer-z""#));
    assert!(props_without_rate.contains(r#""media.name":"Playback""#));
}

// Config plugin: make React Native 0.76's bundled `fmt` pod (11.0.x) compile with Xcode 26's clang.
// Xcode 26 clang rejects fmt's consteval format-string checks when fmt is built as C++20
// ("call to consteval function ... is not a constant expression"). Building the fmt target as C++17
// disables the consteval path (FMT_CONSTEVAL becomes empty) without affecting other pods.
// Applied on every `expo prebuild` (local and EAS), so no manual Podfile patch is needed.
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# @tinypet/with-fmt-xcode26";
const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |bc|
          bc.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
`;

module.exports = function withFmtXcode26(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfile, "utf8");
      if (!contents.includes(MARKER)) {
        // Run after react_native_post_install so nothing it sets can override the fmt target setting.
        const anchor = /react_native_post_install\([\s\S]*?\n\s*\)\n/;
        if (!anchor.test(contents)) throw new Error("[with-fmt-xcode26] react_native_post_install(...) not found in Podfile");
        contents = contents.replace(anchor, (m) => m + SNIPPET);
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};

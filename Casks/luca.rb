cask "luca" do
  version "0.7.3"
  sha256 "ba9f376fa1a79cbe4d7dc32710c1da55a9c38641b8f9694629be4c881e839084"

  url "https://github.com/mediafranca/luca/releases/download/v#{version}/Luca_#{version}_universal.dmg"
  name "Luca"
  desc "Desktop Markdown and Wikitext editor"
  homepage "https://github.com/mediafranca/luca"

  app "Luca.app"
  binary "#{appdir}/Luca.app/Contents/MacOS/luca"

  caveats <<~EOS
    Luca is not notarized by Apple. Homebrew installation does not remove
    Gatekeeper quarantine. See the upstream README for opening instructions.
  EOS
end

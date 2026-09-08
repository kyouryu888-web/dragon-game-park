import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UnoSetupPage } from "./uno/UnoSetupPage";
import { MancalaSetupPage } from "./mancala/MancalaSetupPage";
import { BackgammonSettingsScreen } from "./backgammon/BackgammonSettingsScreen";
import { BabanukiSettingsScreen } from "./babanuki/BabanukiSettingsScreen";

describe("All games setup screen flow contracts", () => {
  describe("UNO Setup Flow", () => {
    it("renders Step I variant, Step II name, Step III match mode, and Step IV clean join UI in join mode", () => {
      const html = renderToStaticMarkup(
        <UnoSetupPage
          onStart={() => undefined}
          onBack={() => undefined}
          onOnlinePlay={() => undefined}
        />
      );

      // Step I is variant selection
      expect(html).toContain("遊戯の掟を選ぶ");
      expect(html).toContain("通常版");
      expect(html).toContain("ハード版");

      // Step II is name
      expect(html).toContain("名を刻む");

      // Step III is match mode
      expect(html).toContain("対戦方法を選ぶ");
      expect(html).toContain("VS CPU");
      expect(html).toContain("ONLINE");

      // Step IV is clean join UI (no duplicate "コードで参加する" headers)
      expect(html).toContain("参加コードを入力");
      expect(html).toContain("このコードで参加する");
      expect(html).not.toContain("対戦相手を決める");
      expect(html).not.toContain("ルーム設定へ進む");
    });
  });

  describe("Mancala Setup Flow", () => {
    it("renders clean 3-step setup without duplicate headers or intermediate buttons in default online join mode", () => {
      const html = renderToStaticMarkup(
        <MancalaSetupPage
          onStart={() => undefined}
          onBack={() => undefined}
          onOnlinePlay={() => undefined}
        />
      );

      // Step I is name
      expect(html).toContain("名を刻む");

      // Step II is match mode
      expect(html).toContain("対戦方法を選ぶ");

      // Step III is clean join UI
      expect(html).toContain("参加コードを入力");
      expect(html).toContain("このコードで参加する");
      expect(html).not.toContain("対戦相手を決める");
      expect(html).not.toContain("ルーム設定へ進む");
    });
  });

  describe("Backgammon Setup Flow", () => {
    it("does not render duplicate join heading in online join mode", () => {
      const html = renderToStaticMarkup(
        <BackgammonSettingsScreen
          config={{ mode: "online", name: "旅人", name2: "", cpuLevel: "normal" }}
          onChange={() => undefined}
          onlineTab="join"
          onOnlineTabChange={() => undefined}
          joinCode="AB12"
          onJoinCodeChange={() => undefined}
          onStart={() => undefined}
          onBackToHome={() => undefined}
        />
      );

      expect(html).toContain("参加コードを入力");
      expect(html).toContain("このコードで参加する");
      expect(html).not.toContain("対戦相手を決める");
      expect(html).not.toContain("CPUの強さ");
      expect(html).not.toContain("ルーム設定へ進む");
    });

    it("renders room creation setup cleanly with single create button", () => {
      const html = renderToStaticMarkup(
        <BackgammonSettingsScreen
          config={{ mode: "online", name: "旅人", name2: "", cpuLevel: "normal" }}
          onChange={() => undefined}
          onlineTab="create"
          onOnlineTabChange={() => undefined}
          joinCode=""
          onJoinCodeChange={() => undefined}
          onStart={() => undefined}
          onBackToHome={() => undefined}
        />
      );

      expect(html).toContain("ルーム作成の準備");
      expect(html).toContain("ルームを作成する");
      expect(html).not.toContain("CPUの強さ");
      expect(html).not.toContain("ルーム設定へ進む");
    });

    it("renders CPU options in CPU mode", () => {
      const html = renderToStaticMarkup(
        <BackgammonSettingsScreen
          config={{ mode: "cpu", name: "旅人", name2: "", cpuLevel: "normal" }}
          onChange={() => undefined}
          onlineTab="create"
          onOnlineTabChange={() => undefined}
          joinCode=""
          onJoinCodeChange={() => undefined}
          onStart={() => undefined}
          onBackToHome={() => undefined}
        />
      );

      expect(html).toContain("対戦相手を決める");
      expect(html).toContain("番人ドラゴン");
      expect(html).toContain("この設定で対戦する");
    });
  });

  describe("Babanuki Setup Flow", () => {
    it("renders clean join mode without duplicate headers or intermediate buttons in online join mode", () => {
      const html = renderToStaticMarkup(
        <BabanukiSettingsScreen
          config={{ playerCount: 4, players: [{ name: "挑戦者", isCpu: false, cpuLevel: "normal" }] }}
          onChange={() => undefined}
          onStart={() => undefined}
          onOnlinePlay={() => undefined}
          onBack={() => undefined}
        />
      );

      expect(html).toContain("名を刻む");
      expect(html).toContain("対戦方法を選ぶ");
      expect(html).toContain("参加コードを入力");
      expect(html).toContain("このコードで参加する");
      expect(html).not.toContain("対戦相手を決める");
      expect(html).not.toContain("ルーム設定へ進む");
    });
  });
});

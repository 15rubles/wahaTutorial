package app.muster.export;

import app.muster.gamedata.api.GameDataDtos.DatasheetDetail;
import app.muster.gamedata.api.GameDataDtos.DetachmentDetail;
import app.muster.gamedata.model.ArmyRule;
import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Faction;
import app.muster.gamedata.model.FactionOption;
import app.muster.gamedata.model.ForceDisposition;
import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.Stratagem;
import app.muster.roster.RosterDtos.RosterView;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Everything the PDF needs in one payload (DESIGN.md 9). Stratagems and glossary hold every
 * candidate; the export options decide in the browser which of them end up in the document.
 */
public record ExportData(
        RosterView roster,
        Faction faction,
        Optional<BattleSize> battleSize,
        Optional<ForceDisposition> forceDisposition,
        List<FactionOption> factionOptions,
        List<ArmyRule> armyRules,
        List<app.muster.gamedata.model.Ability> armyRuleAbilities,
        List<DetachmentDetail> selectedDetachments,
        List<DetachmentDetail> otherDetachments,
        List<Stratagem> coreStratagems,
        Map<String, DatasheetDetail> datasheets,
        Map<String, GlossaryEntry> glossary,
        DataVersionInfo dataVersion) {

    public record DataVersionInfo(long id, Instant createdAt, Optional<Instant> activatedAt) {}
}

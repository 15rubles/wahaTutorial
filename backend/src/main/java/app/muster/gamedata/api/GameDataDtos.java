package app.muster.gamedata.api;

import app.muster.gamedata.model.Ability;
import app.muster.gamedata.model.Allegiance;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Detachment;
import app.muster.gamedata.model.Enhancement;
import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.Stratagem;
import app.muster.gamedata.model.UnitSizeOption;
import app.muster.gamedata.model.WargearOption;
import app.muster.gamedata.model.Weapon;
import java.util.List;
import java.util.Optional;

public final class GameDataDtos {

    private GameDataDtos() {}

    public record FactionSummary(
            String key, String name, Optional<String> parentKey, Optional<Allegiance> allegiance, int datasheetCount) {}

    public record DatasheetSummary(
            String key,
            String name,
            String faction,
            Optional<String> role,
            boolean legends,
            List<String> keywords,
            List<String> factionKeywords,
            List<UnitSizeOption> sizes) {}

    public record NamedRef(String key, String name) {}

    public record DatasheetDetail(
            long versionId,
            Datasheet datasheet,
            List<UnitSizeOption> sizes,
            List<Weapon> weapons,
            List<Ability> abilities,
            List<WargearOption> wargear,
            List<NamedRef> leads,
            List<NamedRef> ledBy) {}

    public record DetachmentDetail(
            Detachment detachment, List<Ability> rules, List<Enhancement> enhancements, List<Stratagem> stratagems) {}

    public record GlossaryDetail(GlossaryEntry entry, List<NamedRef> seeAlso) {}

    public record GlossaryHit(String key, String term, app.muster.gamedata.model.GlossaryKind kind) {}
}

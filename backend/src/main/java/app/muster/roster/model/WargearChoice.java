package app.muster.roster.model;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** One chosen item from a wargear option group: {@code count} models take {@code choice}. */
public record WargearChoice(
        @NotBlank @Size(max = 300) String option, @NotBlank @Size(max = 200) String choice, @Min(1) @Max(100) int count) {}

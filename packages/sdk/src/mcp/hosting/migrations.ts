import type { Migration } from "./wrangler.ts";

interface SingleStepMigration {
  old_tag?: string;
  new_tag?: string;
  new_classes?: string[];
  deleted_classes?: string[];
  renamed_classes?: {
    from: string;
    to: string;
  }[];
}

interface DoBinding {
  type: "durable_object_namespace";
  class_name: string;
  name: string;
}
const bindingIsEqual = (a: DoBinding, b: DoBinding): boolean => {
  return a.class_name === b.class_name;
};
const bindingsAreEqual = (a: DoBinding[], b: DoBinding[]): boolean => {
  return (
    a.length === b.length &&
    a.every((binding, index) => bindingIsEqual(binding, b[index]))
  );
};
const applyMigration =
  (currentBindings: DoBinding[]) =>
  (
    [bindings, stepMigration]: [DoBinding[], SingleStepMigration],
    migration: Migration,
  ): [DoBinding[], SingleStepMigration] => {
    let bindingsResult: DoBinding[] = bindings;
    const shouldRunMigration = stepMigration.old_tag != null;

    if ("new_classes" in migration) {
      bindingsResult = [
        ...bindings,
        ...migration.new_classes.map((className) => ({
          class_name: className,
          name: className,
          type: "durable_object_namespace" as const,
        })),
      ];
      if (shouldRunMigration) {
        stepMigration.new_classes = [
          ...(stepMigration.new_classes ?? []),
          ...migration.new_classes,
        ];
      }
    }

    if ("deleted_classes" in migration) {
      bindingsResult = bindings.filter(
        (binding) => !migration.deleted_classes.includes(binding.class_name),
      );
      if (shouldRunMigration) {
        stepMigration.deleted_classes = [
          ...(stepMigration.deleted_classes ?? []),
          ...migration.deleted_classes,
        ];
      }
    }

    if ("renamed_classes" in migration) {
      const renamedClasses = migration.renamed_classes.reduce(
        (acc, renamedClass) => {
          acc[renamedClass.from] = renamedClass.to;
          return acc;
        },
        {} as Record<string, string>,
      );
      bindingsResult = bindings.map((binding) => ({
        ...binding,
        class_name: renamedClasses[binding.class_name] ?? binding.class_name,
      }));
      if (shouldRunMigration) {
        stepMigration.renamed_classes = [
          ...(stepMigration.renamed_classes ?? []),
          ...migration.renamed_classes,
        ];
      }
    }

    if (bindingsAreEqual(bindingsResult, currentBindings)) {
      stepMigration.old_tag = migration.tag;
    }

    // Set new_tag for any migration that should run OR the next migration after finding current state
    if (shouldRunMigration || stepMigration.old_tag === migration.tag) {
      stepMigration.new_tag = migration.tag;
    }

    return [bindingsResult, stepMigration];
  };

/**
 * Takes wrangler.toml migrations and do bindings and returns a single step migration
 */
export const migrationDiff = (
  allMigrations: Migration[],
  doBindings?: DoBinding[],
): SingleStepMigration | undefined => {
  const currentBindings = doBindings ?? [];
  let simulatedBindings: DoBinding[] = [];
  let foundCurrentState = false;
  let oldTag: string | undefined = undefined;

  const migration: SingleStepMigration = {};

  for (const migrationStep of allMigrations) {
    // Apply this migration to see what the state would be
    const newBindings = applyMigration(currentBindings)(
      [simulatedBindings, migration],
      migrationStep,
    );

    if (!foundCurrentState) {
      // Check if this state matches the current deployment state
      if (bindingsAreEqual(newBindings[0], currentBindings)) {
        foundCurrentState = true;
        oldTag = migrationStep.tag;
        simulatedBindings = newBindings[0];
        continue; // This migration is already applied, skip it
      }
      simulatedBindings = newBindings[0];
    } else {
      // We're past the current state, accumulate this migration in the diff
      if ("new_classes" in migrationStep) {
        migration.new_classes = [
          ...(migration.new_classes ?? []),
          ...migrationStep.new_classes,
        ];
      }

      if ("deleted_classes" in migrationStep) {
        migration.deleted_classes = [
          ...(migration.deleted_classes ?? []),
          ...migrationStep.deleted_classes,
        ];
      }

      if ("renamed_classes" in migrationStep) {
        migration.renamed_classes = [
          ...(migration.renamed_classes ?? []),
          ...migrationStep.renamed_classes,
        ];
      }

      migration.new_tag = migrationStep.tag;
    }
  }

  // If we never found the current state, it means we need to apply all migrations
  if (!foundCurrentState) {
    for (const migrationStep of allMigrations) {
      if ("new_classes" in migrationStep) {
        migration.new_classes = [
          ...(migration.new_classes ?? []),
          ...migrationStep.new_classes,
        ];
      }

      if ("deleted_classes" in migrationStep) {
        migration.deleted_classes = [
          ...(migration.deleted_classes ?? []),
          ...migrationStep.deleted_classes,
        ];
      }

      if ("renamed_classes" in migrationStep) {
        migration.renamed_classes = [
          ...(migration.renamed_classes ?? []),
          ...migrationStep.renamed_classes,
        ];
      }

      migration.new_tag = migrationStep.tag;
    }
    oldTag = undefined; // Starting from scratch
  }

  migration.old_tag = oldTag;

  // Return migration if there are changes to apply
  if (
    migration.new_tag &&
    (migration.new_classes?.length ||
      migration.deleted_classes?.length ||
      migration.renamed_classes?.length)
  ) {
    return migration;
  }

  return undefined;
};
export function isDoBinding(
  binding: unknown | DoBinding,
): binding is DoBinding {
  return (
    binding != null &&
    typeof binding === "object" &&
    "type" in binding &&
    binding.type === "durable_object_namespace"
  );
}

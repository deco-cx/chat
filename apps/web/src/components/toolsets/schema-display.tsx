import { Card } from "@deco/ui/components/card.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";

export interface SchemaProperty {
  type?: string;
  description?: string;
  title?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  anyOf?: Array<{ type: string }>;
  additionalProperties?: boolean;
  items?: SchemaProperty;
  enum?: string[];
  default?: unknown;
}

interface SchemaDisplayProps {
  schema: SchemaProperty | undefined;
  title?: string;
}

function PropertyType({
  type,
  anyOf,
}: {
  type?: string;
  anyOf?: Array<{ type: string; const?: string }>;
}) {
  if (anyOf) {
    return (
      <div className="flex gap-1">
        {anyOf.map((t, i) => (
          <Badge key={i} variant="outline" className="text-xs">
            {t.const ?? t.type}
          </Badge>
        ))}
      </div>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      {type ?? "object"}
    </Badge>
  );
}

function PropertyDisplay({
  name,
  property,
}: {
  name: string;
  property: SchemaProperty;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{name}</Label>
        <PropertyType type={property.type} anyOf={property.anyOf} />
      </div>
      {property.description && (
        <p className="text-xs text-muted-foreground">{property.description}</p>
      )}
      {property.properties && (
        <div className="ml-4 space-y-4 border-l pl-4">
          {Object.entries(property.properties).map(([propName, prop]) => (
            <PropertyDisplay key={propName} name={propName} property={prop} />
          ))}
        </div>
      )}
      {property.items && (
        <div className="ml-4 space-y-4 border-l pl-4">
          <PropertyDisplay name="items" property={property.items} />
        </div>
      )}
      {property.enum && (
        <div className="mt-2">
          <Label className="text-xs font-medium">Allowed Values</Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {property.enum.map((value, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {value}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {property.default !== undefined && (
        <div className="mt-2">
          <Label className="text-xs font-medium">Default Value</Label>
          <Badge variant="secondary" className="text-xs mt-1">
            {String(property.default)}
          </Badge>
        </div>
      )}
    </div>
  );
}

export function SchemaDisplay({ schema, title }: SchemaDisplayProps) {
  if (!schema || !schema?.properties) return null;

  return (
    <Card className="p-4">
      <ScrollArea className="h-[400px]">
        <div className="space-y-4">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {schema.description && (
            <p className="text-sm text-muted-foreground">
              {schema.description}
            </p>
          )}
          {schema.properties && (
            <div className="space-y-4">
              {Object.entries(schema.properties).map(([name, property]) => (
                <PropertyDisplay key={name} name={name} property={property} />
              ))}
            </div>
          )}
          {schema.required && schema.required.length > 0 && (
            <div className="mt-4">
              <Label className="text-sm font-medium">Required Fields</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {schema.required.map((field) => (
                  <Badge key={field} variant="secondary" className="text-xs">
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

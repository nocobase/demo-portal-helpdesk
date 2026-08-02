"use client";

import { useGetLocale, useSetLocale, useTranslate } from "@refinedev/core";
import { useEnabledLocales } from "@nocobase/portal-sdk/i18n";
import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type LanguageToggleProps = {
  className?: string;
};

export function LanguageToggle({ className }: LanguageToggleProps) {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const setLocale = useSetLocale();
  const locales = useEnabledLocales();
  const currentLocale = getLocale();

  if (locales.length < 2) return null;

  const label = translate("language.label", { ns: "nocobase-i18n" }, "Language");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            title={label}
            aria-label={label}
            className={cn(
              "size-10 rounded-xl border-border/70 bg-background/60",
              className
            )}
          >
            <Languages className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">{label}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44 p-1">
        <DropdownMenuRadioGroup
          value={currentLocale}
          onValueChange={(value) => {
            if (value && value !== currentLocale) void setLocale(value);
          }}
        >
          {locales.map((definition) => (
            <DropdownMenuRadioItem
              key={definition.locale}
              value={definition.locale}
            >
              {definition.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

LanguageToggle.displayName = "LanguageToggle";

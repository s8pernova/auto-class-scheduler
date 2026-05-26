import { useEffect, useId, useMemo, useState } from "react";

type CreatableComboboxProps = {
    value: string;
    options: string[];
    onValueChange: (value: string) => void;
    onCreateOption?: (value: string) => void;

    placeholder?: string;
    allowCreate?: boolean;
    commitOnBlur?: boolean;
    maxVisibleOptions?: number;

    emptyMessage?: string;
    createLabel?: (value: string) => string;
    normalize?: (value: string) => string;
    filterOption?: (option: string, query: string) => boolean;

    disabled?: boolean;
    className?: string;
    inputClassName?: string;
    listClassName?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

export function normalizeString(value: string) {
    return value.trim().replace(/\s+/g, " ");
}

function sameOption(a: string, b: string) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function defaultFilterOption(option: string, query: string) {
    return option.toLowerCase().includes(query.toLowerCase());
}

export function useLocalStorageStringOptions(
    storageKey: string,
    initialOptions: string[] = [],
) {
    const [options, setOptions] = useState<string[]>(initialOptions);

    useEffect(() => {
        const rawValue = window.localStorage.getItem(storageKey);

        if (!rawValue) return;

        try {
            const parsedValue = JSON.parse(rawValue);

            if (Array.isArray(parsedValue)) {
                const savedOptions = parsedValue.filter(
                    (item): item is string => typeof item === "string",
                );

                setOptions(savedOptions);
            }
        } catch {
            setOptions(initialOptions);
        }
    }, [storageKey]);

    function saveOptions(nextOptions: string[]) {
        setOptions(nextOptions);
        window.localStorage.setItem(storageKey, JSON.stringify(nextOptions));
    }

    function addOption(rawOption: string) {
        const option = normalizeString(rawOption);

        if (!option) return;

        setOptions((currentOptions) => {
            if (
                currentOptions.some((currentOption) =>
                    sameOption(currentOption, option),
                )
            ) {
                return currentOptions;
            }

            const nextOptions = [...currentOptions, option].sort((a, b) =>
                a.localeCompare(b),
            );

            window.localStorage.setItem(
                storageKey,
                JSON.stringify(nextOptions),
            );

            return nextOptions;
        });
    }

    function removeOption(rawOption: string) {
        const option = normalizeString(rawOption);

        const nextOptions = options.filter(
            (currentOption) => !sameOption(currentOption, option),
        );

        saveOptions(nextOptions);
    }

    return {
        options,
        setOptions: saveOptions,
        addOption,
        removeOption,
    };
}

export default function CreatableCombobox({
    value,
    options,
    onValueChange,
    onCreateOption,

    placeholder = "Type or select...",
    allowCreate = true,
    commitOnBlur = true,
    maxVisibleOptions = 8,

    emptyMessage = "No matches",
    createLabel = (value) => `Add "${value}"`,
    normalize = normalizeString,
    filterOption = defaultFilterOption,

    disabled = false,
    className,
    inputClassName,
    listClassName,
}: CreatableComboboxProps) {
    const listboxId = useId();

    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const normalizedValue = normalize(value);
    const hasInput = normalizedValue.length > 0;

    const filteredOptions = useMemo(() => {
        const query = value.trim();

        const filtered = query
            ? options.filter((option) => filterOption(option, query))
            : options;

        return filtered.slice(0, maxVisibleOptions);
    }, [filterOption, maxVisibleOptions, options, value]);

    const exactMatch = options.find((option) =>
        sameOption(option, normalizedValue),
    );
    const canCreate = allowCreate && hasInput && !exactMatch;

    const activeOption = filteredOptions[activeIndex];
    const activeOptionId =
        isOpen && activeOption
            ? `${listboxId}-option-${activeIndex}`
            : undefined;

    useEffect(() => {
        if (activeIndex >= filteredOptions.length) {
            setActiveIndex(Math.max(filteredOptions.length - 1, 0));
        }
    }, [activeIndex, filteredOptions.length]);

    function closeList() {
        setIsOpen(false);
        setActiveIndex(0);
    }

    function commitValue(rawValue: string) {
        const nextValue = normalize(rawValue);

        if (!nextValue) {
            closeList();
            return;
        }

        const existingOption = options.find((option) =>
            sameOption(option, nextValue),
        );

        if (existingOption) {
            onValueChange(existingOption);
            closeList();
            return;
        }

        if (allowCreate) {
            onValueChange(nextValue);
            onCreateOption?.(nextValue);
            closeList();
            return;
        }

        closeList();
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === "ArrowDown") {
            event.preventDefault();

            setIsOpen(true);
            setActiveIndex((currentIndex) => {
                const maxIndex = filteredOptions.length - 1;

                if (maxIndex < 0) return 0;

                return Math.min(currentIndex + 1, maxIndex);
            });

            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();

            setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));

            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();

            if (isOpen && activeOption) {
                commitValue(activeOption);
                return;
            }

            commitValue(value);
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            closeList();
        }
    }

    return (
        <div className={cx("relative", className)}>
            <input
                value={value}
                disabled={disabled}
                placeholder={placeholder}
                role="combobox"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listboxId : undefined}
                aria-activedescendant={activeOptionId}
                aria-autocomplete="list"
                className={cx(
                    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none",
                    "focus:border-gray-500 focus:ring-2 focus:ring-gray-200",
                    disabled && "cursor-not-allowed bg-gray-100 text-gray-500",
                    inputClassName,
                )}
                onChange={(event) => {
                    onValueChange(event.target.value);
                    setIsOpen(true);
                    setActiveIndex(0);
                }}
                onFocus={() => setIsOpen(true)}
                onBlur={() => {
                    if (commitOnBlur) {
                        commitValue(value);
                    } else {
                        closeList();
                    }
                }}
                onKeyDown={handleKeyDown}
            />

            {isOpen && !disabled && (
                <div
                    id={listboxId}
                    role="listbox"
                    className={cx(
                        "absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg",
                        listClassName,
                    )}
                >
                    {filteredOptions.map((option, index) => {
                        const isActive = index === activeIndex;

                        return (
                            <button
                                id={`${listboxId}-option-${index}`}
                                key={option}
                                type="button"
                                role="option"
                                aria-selected={isActive}
                                className={cx(
                                    "block w-full px-3 py-2 text-left text-sm",
                                    isActive ? "bg-gray-100" : "bg-white",
                                    "hover:bg-gray-100",
                                )}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    commitValue(option);
                                }}
                            >
                                {option}
                            </button>
                        );
                    })}

                    {canCreate && (
                        <button
                            type="button"
                            className="block w-full border-t border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                            onMouseDown={(event) => {
                                event.preventDefault();
                                commitValue(value);
                            }}
                        >
                            {createLabel(normalizedValue)}
                        </button>
                    )}

                    {filteredOptions.length === 0 && !canCreate && (
                        <div className="px-3 py-2 text-sm text-gray-500">
                            {emptyMessage}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

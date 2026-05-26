import { useEffect, useState } from "react";

type EditableTextCellProps = {
    value: string;
    onCommit: (value: string) => void;
    className?: string;
};

export function EditableTextCell({
    value,
    onCommit,
    className = "",
}: EditableTextCellProps) {
    const [draftValue, setDraftValue] = useState(value);

    useEffect(() => {
        setDraftValue(value);
    }, [value]);

    function handleBlur() {
        const nextValue = draftValue.trim();
        if (nextValue && nextValue !== value) {
            onCommit(nextValue);
        } else {
            setDraftValue(value);
        }
    }

    return (
        <input
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onBlur={handleBlur}
            className={`w-full bg-transparent outline-none border border-transparent rounded px-2 py-1 focus:border-accent hover:border-background/20 ${className}`}
        />
    );
}

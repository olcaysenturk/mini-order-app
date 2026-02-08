"use client";

import { useEffect, useState } from "react";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
    value: number;
    onChange: (value: number) => void;
    className?: string;
}

export function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
    // Formatlamada kullanılacak
    const format = (val: number) =>
        new Intl.NumberFormat("tr-TR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(val);

    const [isFocused, setIsFocused] = useState(false);
    const [displayValue, setDisplayValue] = useState("");

    // Dışarıdan value değişirse senkronla (focus değilken)
    useEffect(() => {
        if (!isFocused) {
            setDisplayValue(format(value));
        }
    }, [value, isFocused]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        // Focus olunca raw değeri göster (örn: 1234.56 -> "1234,56")
        // TR klavyede virgül kolay, o yüzden virgül yapalım
        setDisplayValue(value === 0 ? "" : value.toString().replace(".", ","));
        props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        // Blur olunca parse et ve parent'a bildir
        const raw = displayValue.replace(/\./g, "").replace(",", "."); // binlik ayracı nokta ise sil, virgülü nokta yap
        const parsed = parseFloat(raw);

        let final = 0;
        if (!isNaN(parsed)) {
            final = parsed;
        }

        onChange(final);
        setDisplayValue(format(final));
        props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Sadece rakam, virgül ve nokta izni (nokta belki binlik ayracı olarak gelir ama inputta izin verelim)
        const val = e.target.value;
        // Basit filtre: sadece sayı, virgül, nokta
        if (/^[0-9,.]*$/.test(val)) {
            setDisplayValue(val);
        }
    };

    return (
        <input
            {...props}
            type="text"
            inputMode="decimal"
            className={className}
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
        />
    );
}

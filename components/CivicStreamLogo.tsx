import Image from "next/image";

export function CivicStreamLogo({ className = "" }: { className?: string }) {
    return (
        <Image src="/logo-icon-no-bg.svg" alt="CivicStream Logo" width={64} height={64} />
    );
} 
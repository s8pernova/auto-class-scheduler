import type { ReactNode } from "react";

export default function Navbar({ center }: { center?: ReactNode }) {
    return (
        <div className="text-text col-span-full flex justify-between items-center">
            <div className="w-full">Logo</div>
            <div className="w-full flex justify-center">
                {center}
            </div>
            <div className="w-full text-end">Favs and Username</div>
        </div>
    );
}


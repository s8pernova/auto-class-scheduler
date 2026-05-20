import LayoutPagination from "@/components/LayoutPagination";

export default function Navbar() {
    return (
        <div className="text-text col-span-full flex justify-between items-center">
            <div className="w-full">Logo</div>
            <div className="w-full text-center">
                <LayoutPagination />
            </div>
            <div className="w-full text-end">Favs and Username</div>
        </div>
    );
}

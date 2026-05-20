import { Outlet } from "react-router-dom";
import Navbar from "@/components/Navbar";

export default function Layout() {
    return (
        <div className="grid grid-cols-[288px_1fr_545px] grid-rows-[38px_1fr] h-screen gap-[15px] p-[15px]">
            <Navbar />
            <Outlet />
        </div>
    );
}

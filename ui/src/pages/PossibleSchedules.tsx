import Card from "@/components/Card"

function PossibleSchedules() {
    return (
        <div className="flex p-[20px] h-screen">
            <aside className="w-[22%] text-text">
                <h2>Hello world</h2>
                <h2>Hello world</h2>
                <h2>Hello world</h2>
            </aside>
            <main className="bg-surface w-full h-full rounded-[10px] grid grid-cols-6 grid-rows-3">
                <Card />
                <Card />
                <Card />
                <Card />
            </main>
        </div>
    );
}

export default PossibleSchedules;

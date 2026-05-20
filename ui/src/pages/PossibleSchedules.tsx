import Card from "@/components/Card";

function PossibleSchedules() {
    return (
        <>
            <aside className="text-text">
                <h2>Hello world</h2>
                <h2>Hello world</h2>
                <h2>Hello world</h2>
            </aside>
            <main className="bg-surface rounded-[10px] grid grid-cols-6 grid-rows-3 p-[10px] gap-[10px]">
                <Card />
                <Card />
                <Card />
                <Card />
            </main>
            <aside className="bg-surface rounded-[10px]">
                <h2>Hello world</h2>
                <h2>Hello world</h2>
                <h2>Hello world</h2>
            </aside>
        </>
    );
}

export default PossibleSchedules;

export default function Error(error) {
	return (
		<div className="flex justify-center items-center min-h-screen flex-col gap-4">
			<p className="text-xl font-semibold text-red-500">Error: {error} :(</p>
			<button
				onClick={() => window.location.reload()}
				className="px-5 py-2 bg-blue-500 text-white rounded-full font-semibold cursor-pointer"
			>
				Retry
			</button>
		</div>
	);
}

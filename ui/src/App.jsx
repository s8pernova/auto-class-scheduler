import Card from "./components/card.jsx";
import "./App.css";

function App() {

	const data = {
		"schedule_id": 1,
		"subject_code": "PHY",
		"course_number": 241,
		"section_code": "A",
		"course_title": "Physics",
		"credits": 3
	}
	
	return (
		<div className="p-10 grid grid-cols-3 md:grid-cols-4 2xl:grid-cols-5 gap-10">
			<Card {...data}/>
			<Card {...data}/>
			<Card {...data}/>
			<Card {...data}/>
			<Card {...data}/>
			<Card {...data}/>
			<Card {...data}/>
			<Card {...data}/>
			<Card {...data}/>
			<Card {...data}/>
			<Card {...data}/>
			<Card {...data}/>
		</div>
	);
}

export default App;

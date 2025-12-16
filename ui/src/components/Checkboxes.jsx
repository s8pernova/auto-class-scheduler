import { MdCheckBoxOutlineBlank, MdOutlineCheckBox } from "react-icons/md";

const checkboxStyle = "w-7 h-7 text-gray-400 hover:scale-110 hover:text-gray-300 transition duration-300";

export default function CheckboxSelected() {
	return (
		<MdOutlineCheckBox className={checkboxStyle} />
	);
}

export default function CheckboxUnselected() {
	return (
		<MdCheckBoxOutlineBlank className={checkboxStyle} />
	);
}
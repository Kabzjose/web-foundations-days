let notes = [
	{ id: 1, text: "Buy milk and bread", category: "personal" },
	{ id: 2, text: "Finish the Day 3 assignment", category: "study" },
	{ id: 3, text: "Email the project report to Grace", category: "work" },
	{ id: 4, text: "Revise JavaScript arrays", category: "study" },
	{ id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
	const searchTerm = word.toLowerCase();
	return notes.filter((note) => note.text.toLowerCase().includes(searchTerm));
}

function longestNote() {
	if (notes.length === 0) {
		return null;
	}

	let longest = notes[0];
	for (const note of notes) {
		if (note.text.length > longest.text.length) {
			longest = note;
		}
	}
	return longest;
}

function countByCategory() {
	const counts = {};
	for (const note of notes) {
		if (counts[note.category] === undefined) {
			counts[note.category] = 0;
		}
		counts[note.category]++;
	}
	return counts;
}

function getSummary() {
	const counts = countByCategory();
	const noteWord = notes.length === 1 ? "note" : "notes";
	return `${notes.length} ${noteWord}: ${counts.personal || 0} personal, ${counts.work || 0} work, ${counts.study || 0} study.`;
}

function isDuplicate(text) {
	const normalizedText = text.trim().toLowerCase();
	return notes.some((note) => note.text.trim().toLowerCase() === normalizedText);
}

function addNote(text, category) {
	const validCategories = ["personal", "work", "study"];

	if (text.length < 1 || text.length > 200) {
		console.log("Note was not added: text must be 1-200 characters.");
		return false;
	}
	if (isDuplicate(text)) {
		console.log("Note was not added: duplicate text.");
		return false;
	}
	if (!validCategories.includes(category)) {
		console.log("Note was not added: invalid category.");
		return false;
	}

	notes.push({
		id: notes.length === 0 ? 1 : Math.max(...notes.map((note) => note.id)) + 1,
		text,
		category,
	});
	console.log("Note added.");
	return true;
}

console.log(searchNotes("DAY")); // Expected: [{ id: 2, text: "Finish the Day 3 assignment", category: "study" }]
console.log(searchNotes("nothing")); // Expected: []

console.log(longestNote()); // Expected: { id: 3, text: "Email the project report to Grace", category: "work" }
const savedNotes = notes;
notes = [];
console.log(longestNote()); // Expected: null
notes = savedNotes;

console.log(countByCategory()); // Expected: { personal: 2, study: 2, work: 1 }
notes = [];
console.log(countByCategory()); // Expected: {}
notes = savedNotes;

console.log(getSummary()); // Expected: "5 notes: 2 personal, 1 work, 2 study."
notes = [{ id: 1, text: "One note", category: "personal" }];
console.log(getSummary()); // Expected: "1 note: 1 personal, 0 work, 0 study."
notes = savedNotes;

console.log(isDuplicate("  BUY MILK AND BREAD  ")); // Expected: true
console.log(isDuplicate("A brand new note")); // Expected: false

console.log(addNote("Plan the weekend", "personal")); // Expected: true
console.log(addNote("  buy milk and bread ", "personal")); // Expected: false

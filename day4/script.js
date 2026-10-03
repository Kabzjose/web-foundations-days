const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearButton = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

const draftKey = "quick-notes-draft";
const themeKey = "quick-notes-theme";
const maxCharacters = 200;
const warningThreshold = 180;

function updateCounts() {
	const text = noteText.value;
	const words = text.trim() ? text.trim().split(/\s+/).length : 0;

	charCount.textContent = `${text.length} / ${maxCharacters} characters`;
	wordCount.textContent = `${words} words`;
	charCount.classList.toggle("warning", text.length > warningThreshold && text.length <= maxCharacters);
	charCount.classList.toggle("over", text.length > maxCharacters);
}

function clearNote() {
	noteText.value = "";
	localStorage.removeItem(draftKey);
	updateCounts();
}

function updateThemeLabel() {
	themeToggle.textContent = document.body.classList.contains("dark") ? "Light mode" : "Dark mode";
}

noteText.addEventListener("input", () => {
	localStorage.setItem(draftKey, noteText.value);
	updateCounts();
});

clearButton.addEventListener("click", clearNote);

themeToggle.addEventListener("click", () => {
	document.body.classList.toggle("dark");
	const isDark = document.body.classList.contains("dark");
	localStorage.setItem(themeKey, isDark ? "dark" : "light");
	updateThemeLabel();
});

noteText.addEventListener("keydown", (event) => {
	if (event.key === "Escape") {
		clearNote();
	}
});

const savedDraft = localStorage.getItem(draftKey);
if (savedDraft !== null) {
	noteText.value = savedDraft;
}

if (localStorage.getItem(themeKey) === "dark") {
	document.body.classList.add("dark");
}

updateThemeLabel();
updateCounts();

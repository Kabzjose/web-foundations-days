const API_URL = "https://jsonplaceholder.typicode.com/users";

const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const status = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

let users = [];

function renderUsers(list) {
	usersList.replaceChildren();

	if (list.length === 0) {
		return;
	}

	list.forEach((user) => {
		const userItem = document.createElement("li");
		const name = document.createElement("h2");
		const email = document.createElement("p");
		const city = document.createElement("p");
		const company = document.createElement("p");

		name.textContent = user.name;
		email.textContent = `Email: ${user.email}`;
		city.textContent = `City: ${user.address.city}`;
		company.textContent = `Company: ${user.company.name}`;

		userItem.append(name, email, city, company);
		usersList.appendChild(userItem);
	});
}

function renderFilteredUsers() {
	const filterText = filterInput.value.trim().toLowerCase();
	const filteredUsers = users.filter((user) =>
		user.name.toLowerCase().includes(filterText)
	);

	renderUsers(filteredUsers);

	if (filteredUsers.length === 0) {
		status.textContent = "No users match your filter.";
	} else if (filterText) {
		status.textContent = `Showing ${filteredUsers.length} user${filteredUsers.length === 1 ? "" : "s"}.`;
	} else {
		status.textContent = `Loaded ${filteredUsers.length} users.`;
	}
}

async function loadUsers() {
	status.textContent = "Loading users...";
	loadButton.disabled = true;
	usersList.replaceChildren();

	try {
		const response = await fetch(API_URL);
		if (!response.ok) {
			throw new Error(`Request failed with status ${response.status}`);
		}

		users = await response.json();
		renderFilteredUsers();
	} catch (error) {
		status.textContent = "Could not load users. Please try again.";
		console.error(error);
	} finally {
		loadButton.disabled = false;
	}
}

loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", renderFilteredUsers);

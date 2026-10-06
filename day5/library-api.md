# Library Books API

The API uses the `/books` resource. Requests and responses use JSON.

## Endpoints

- **List books**
  - **Method:** `GET`
  - **Path:** `/books`
  - **Description:** Returns all books in the library.
  - **Success status:** `200 OK`

- **Get one book**
  - **Method:** `GET`
  - **Path:** `/books/{id}`
  - **Description:** Returns the book with the specified ID.
  - **Success status:** `200 OK`

- **Create a book**
  - **Method:** `POST`
  - **Path:** `/books`
  - **Description:** Adds a new book to the library.
  - **Example request body:** `{"title":"The Hobbit","author":"J.R.R. Tolkien","publishedYear":1937}`
  - **Success status:** `201 Created`

- **Update a book**
  - **Method:** `PUT`
  - **Path:** `/books/{id}`
  - **Description:** Replaces the details of an existing book.
  - **Example request body:** `{"title":"The Hobbit","author":"J.R.R. Tolkien","publishedYear":1937}`
  - **Success status:** `200 OK`

- **Delete a book**
  - **Method:** `DELETE`
  - **Path:** `/books/{id}`
  - **Description:** Removes the specified book from the library.
  - **Success status:** `204 No Content`

- **List books by an author**
  - **Method:** `GET`
  - **Path:** `/books?author={author}`
  - **Description:** Returns books whose author matches the `author` query parameter.
  - **Success status:** `200 OK`

## Error codes

- **`400 Bad Request`:** The request is invalid, such as creating a book without the required `title` or `author` fields.
- **`404 Not Found`:** The requested book ID does not exist, such as `GET /books/9999`.

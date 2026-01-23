# TaskZen Project: Full-Stack MERN Task Manager App 🌟

![TaskZen Logo](https://via.placeholder.com/150)  
[![Latest Release](https://img.shields.io/github/v/release/Benjackrak/taskzen-project)](https://github.com/Benjackrak/taskzen-project/releases)  
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Overview

TaskZen is a clean, full-stack MERN task manager app designed to help you manage your tasks efficiently. It includes user authentication, CRUD operations, filtering options, and a distraction-free user interface. Whether you are a student, professional, or anyone in between, TaskZen can help you stay organized.

## Features

- **User Authentication**: Secure login and registration using JWT.
- **CRUD Operations**: Create, Read, Update, and Delete tasks with ease.
- **Filtering**: Filter tasks based on status or category.
- **Distraction-Free UI**: Minimalist design to help you focus.
- **Responsive Design**: Works on all devices.
- **Dark Mode**: Switch between light and dark themes.

## Technologies Used

- **Frontend**: React.js, CSS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: JWT, bcryptjs

## Installation

To get started with TaskZen, follow these steps:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Benjackrak/taskzen-project.git
   cd taskzen-project
   ```

2. **Install dependencies**:
   For the server:
   ```bash
   cd server
   npm install
   ```

   For the client:
   ```bash
   cd client
   npm install
   ```

3. **Environment Variables**:
   Create a `.env` file in the server directory and add the following variables:
   ```
   MONGODB_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   ```

4. **Run the application**:
   Start the server:
   ```bash
   cd server
   npm start
   ```

   Start the client:
   ```bash
   cd client
   npm start
   ```

5. **Visit the app**:
   Open your browser and go to `http://localhost:3000`.

## Usage

Once you have the app running, you can create an account or log in with your existing credentials. After logging in, you can:

- Add new tasks by filling out the form.
- Edit or delete tasks by clicking the respective buttons.
- Use the filter options to view specific tasks.

## API Endpoints

### Authentication

- **POST /api/auth/register**: Register a new user.
- **POST /api/auth/login**: Log in an existing user.

### Tasks

- **GET /api/tasks**: Retrieve all tasks for the logged-in user.
- **POST /api/tasks**: Create a new task.
- **PUT /api/tasks/:id**: Update an existing task.
- **DELETE /api/tasks/:id**: Delete a task.

## Contributing

We welcome contributions! If you want to contribute to TaskZen, please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes and commit them.
4. Push to your branch.
5. Open a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or feedback, feel free to reach out:

- **GitHub**: [Benjackrak](https://github.com/Benjackrak)
- **Email**: benjackrak@example.com

For the latest releases, visit [here](https://github.com/Benjackrak/taskzen-project/releases). Download the necessary files and execute them as instructed.

---

Feel free to explore the code and contribute to making TaskZen even better!

This file initializes the database when the container starts.

What it does:
- Creates a table named todos if it does not already exist.
- Defines columns:
  - id: auto-increment primary key
  - title: text field, required
  - done: boolean flag, defaults to false
  - created_at: timestamp, defaults to current time
- Inserts one default row into the todos table if that title does not already exist.
- Creates a MySQL user named exporter for monitoring purposes.
- Grants that user limited permissions needed by Prometheus/MySQL exporter.
- Applies the permission changes immediately with FLUSH PRIVILEGES.

In short, it sets up the app’s initial database structure and prepares a monitoring account.

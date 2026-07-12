async function loadTodos() {
  const output = document.getElementById("output");
  output.textContent = "Loading...";
  try {
    const res = await fetch("/api/todos");
    const data = await res.json();
    output.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    output.textContent = "Error: " + err.message;
  }
}

document.getElementById("refresh").addEventListener("click", loadTodos);

document.getElementById("todo-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("title");
  const title = input.value.trim();
  if (!title) return;

  await fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });

  input.value = "";
  loadTodos();
});

loadTodos();

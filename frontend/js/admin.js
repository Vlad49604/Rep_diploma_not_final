const addTypeSelect = document.getElementById("addTypeSelect");
const courseForm = document.getElementById("courseForm");
const sectionForm = document.getElementById("sectionForm");
const taskForm = document.getElementById("taskForm");

addTypeSelect.addEventListener("change", () => {
  const type = addTypeSelect.value;
  courseForm.style.display = "none";
  sectionForm.style.display = "none";
  taskForm.style.display = "none";

  if (type === "course") courseForm.style.display = "block";
  else if (type === "section") sectionForm.style.display = "block";
  else if (type === "task") taskForm.style.display = "block";
});

async function fetchCourses() {
  const res = await fetch("http://localhost:5002/api/courses");
  return await res.json();
}

async function updateSelects() {
  const courses = await fetchCourses();

  const courseSelectSection = document.getElementById("courseSelectSection");
  const courseSelectTask = document.getElementById("courseSelectTask");
  courseSelectSection.innerHTML = "";
  courseSelectTask.innerHTML = "";

  courses.forEach((c) => {
    const opt1 = document.createElement("option");
    opt1.value = c._id;
    opt1.textContent = c.title;
    courseSelectSection.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = c._id;
    opt2.textContent = c.title;
    courseSelectTask.appendChild(opt2);
  });

  // можна викликати оновлення секцій для завдань
  if (typeof updateSectionOptions === "function") updateSectionOptions();
}

updateSelects();

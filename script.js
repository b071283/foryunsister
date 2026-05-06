document.addEventListener("DOMContentLoaded", () => {
  const tagGrids = document.querySelectorAll(".tag-grid");

  tagGrids.forEach((grid) => {
    grid.addEventListener("click", (e) => {
      const target = e.target;
      if (target.classList.contains("tag")) {
        target.classList.toggle("active");
      }
    });
  });

  const submitBtn = document.getElementById("submit-btn");
  const result = document.getElementById("result");

  submitBtn.addEventListener("click", () => {
    const data = {};
    tagGrids.forEach((grid) => {
      const group = grid.dataset.group;
      const selected = Array.from(grid.querySelectorAll(".tag.active")).map(
        (t) => t.textContent.trim()
      );
      data[group] = selected;
    });

    result.hidden = false;
    result.textContent = "你選擇的項目：\n" + JSON.stringify(data, null, 2);
  });
});

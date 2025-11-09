function resolveHost(candidates) {
  const clientAddress = window.location.hostname;

  // Try to match, in order, the client IP to any of the
  // subnets to find the adequate 3rd party host
  for (const sh of candidates) {
    const [subnet, serverAddress] = Object.entries(sh)[0];
    const subnetRegex = new RegExp(
      "^" + subnet.replace(/\./g, "\\.").replace(/\*/g, "\\d+") + "$",
    );

    if (subnetRegex.test(clientAddress)) {
      return serverAddress;
    }
  }

  return "localhost";
}

async function loadServices() {
  const res = await fetch("services.yaml");
  const text = await res.text();
  const data = jsyaml.load(text);

  const servicesData = data.services;
  const serverAddress = resolveHost(data["host-resolution"] || []);

  const services = Object.entries(servicesData).map(
    ([groupName, groupServices]) => {
      const children = Object.entries(groupServices).map(
        ([serviceName, serviceList]) => {
          const svcObj = {};
          serviceList.forEach((entry) => Object.assign(svcObj, entry));

          let endpoint;
          if (svcObj.host && !svcObj.port) {
            // If hard host, do not bother with port
            endpoint = svcObj.host;
          } else {
            const host = svcObj.host ?? serverAddress;
            const port = svcObj.port ? `:${svcObj.port}` : "";
            endpoint = `http://${host}${port}`;
            // endpoint = `http://${host}${port}`;
          }

          return {
            displayName: serviceName,
            endpoint: endpoint,
            icon: svcObj.icon ?? null,
            newtab: svcObj.newtab ?? null,
          };
        },
      );

      return {
        displayName: groupName,
        children,
      };
    },
  );

  return services;
}

eleContent = document.querySelector(".content");
eleSidebar = document.querySelector(".sidebar");

async function populateFromYaml() {
  const services = await loadServices();

  Object.values(services).forEach((srv) => {
    // Create from template and fetch children
    const templateGroup = document.getElementById("template-group");
    const eleGroup = templateGroup.content.cloneNode(true);
    const eleGroupHeader = eleGroup.querySelector(".group-header");
    const eleGroupHeaderName = eleGroupHeader.querySelector(".name");
    const eleGroupContent = eleGroup.querySelector(".group-content");

    // Set category name
    eleGroupHeaderName.textContent = srv.displayName;

    Object.entries(srv.children).forEach(([key, child]) => {
      // Create from template and fetch children
      const templateService = document.getElementById("template-service-litem");
      const eleServiceMenuItem = templateService.content.cloneNode(true);
      const eleButton = eleServiceMenuItem.querySelector("button");

      // Create iframe in the content area
      const iframe = document.createElement("iframe");
      iframe.id = child.displayName.toLowerCase();
      iframe.src = child.endpoint;
      iframe.allow = "fullscreen";
      eleContent.appendChild(iframe);

      // Set button content
      eleServiceMenuItem.querySelector("span").textContent = child.displayName;
      eleServiceMenuItem.querySelector("img").src = child.icon;

      // Set button actions
      eleButton.id = child.displayName.toLowerCase() + "-btn"; // FIXME weak
      eleButton.onclick = (event) => {
        console.log(event);
        if (event.ctrlKey || child.newtab) {
          window.open(iframe.src, "_blank").focus();
        } else {
          displayServiceIframe(iframe.id, eleButton);
        }
      };

      // Append button to category
      eleGroupContent.appendChild(eleServiceMenuItem);
    });

    // Append category group to sidebar
    eleSidebar.appendChild(eleGroup);
  });
}

function collapseGroupToggle(eleGroupHeader) {
  const eleGroupContent = eleGroupHeader.nextElementSibling;
  const eleArrow = eleGroupHeader.querySelector(".toggle-arrow");

  eleGroupContent.classList.toggle("collapsed");
  eleArrow.textContent = eleGroupContent.classList.contains("collapsed")
    ? "►"
    : "▼";
}

function displayServiceIframe(id, btnElem) {
  // Remove class active from all iframes and menu entries
  document.querySelectorAll("iframe").forEach((f) =>
    f.classList.remove("active")
  );
  document.querySelectorAll(".sidebar button").forEach((b) =>
    b.classList.remove("active", "focused")
  );

  // Add class active to just the selected item and entry
  document.getElementById(id).classList.add("active");
  btnElem.classList.add("active", "focused");

  // Clear the search box and update it
  document.querySelector("#search").value = "";
  updateSearchFilter();

  // Expand parent group of selected item if collapsed
  const groupContent = btnElem.closest(".group-content");
  if (groupContent.classList.contains("collapsed")) {
    groupContent.classList.remove("collapsed");
    const arrow = groupContent.previousElementSibling.querySelector(
      "span:last-child",
    );
    if (arrow) arrow.textContent = "▼";
  }

  // Update URL parameter
  const url = new URL(window.location);
  url.searchParams.set("page", id);
  history.replaceState(null, "", url);
}

function updateSearchFilter() {
  const query = document.getElementById("search").value.toLowerCase();
  const groups = document.querySelectorAll(".group");

  groups.forEach((group) => {
    const buttons = group.querySelectorAll("button");
    let visible = 0;
    buttons.forEach((btn) => {
      const match = btn.innerText.toLowerCase().includes(query);
      btn.style.display = match ? "" : "none";
      if (match) visible++;
    });
    group.style.display = visible > 0 ? "" : "none";
  });
}

eleSidebar.addEventListener("keydown", (e) => {
  // skip if search input is focused
  if (document.activeElement.tagName === "INPUT") return;

  const buttons = Array.from(document.querySelectorAll(".sidebar button"))
    .filter((b) => b.offsetParent !== null);
  let current = buttons.findIndex((b) =>
    b.classList.contains("focused") || b.classList.contains("active")
  );
  const upKeys = ["ArrowUp", "w", "W", "k", "K"];
  const downKeys = ["ArrowDown", "s", "S", "j", "J"];

  if (upKeys.includes(e.key)) {
    e.preventDefault();
    current = (current - 1 + buttons.length) % buttons.length;
    displayServiceIframe(
      buttons[current].id.replace("-btn", ""),
      buttons[current],
    );
  } else if (downKeys.includes(e.key)) {
    e.preventDefault();
    current = (current + 1) % buttons.length;
    displayServiceIframe(
      buttons[current].id.replace("-btn", ""),
      buttons[current],
    );
  }
});

function loadInitialIFrame() {
  eleSidebar.focus();
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");
  let btn = (page !== null) ? document.getElementById(page + "-btn") : null;
  if (!btn) btn = document.querySelector(".sidebar button");
  if (btn) displayServiceIframe(btn.id.replace("-btn", ""), btn);
}

window.addEventListener("load", async () => {
  await populateFromYaml();
  loadInitialIFrame();
});

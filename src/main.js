function resolveHost(candidates) {
  const clientAddress = window.location.hostname;

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
  console.log(serverAddress);

  return Object.entries(servicesData).map(([groupName, groupServices]) => ({
    displayName: groupName,
    children: Object.entries(groupServices).map(
      ([serviceName, serviceList]) => {
        const svcObj = {};
        serviceList.forEach((entry) => Object.assign(svcObj, entry));

        let endpoint;

        // Valid URL is used as destination
        if (
          svcObj.host?.startsWith("http://") ||
          svcObj.host?.startsWith("https://")
        ) {
          endpoint = svcObj.host;
        } // No host port or path? Use server's plus serviceName as path for reverse proxy/redir
        else if (!svcObj.host && !svcObj.port && !svcObj.path) {
          endpoint = `http://${serverAddress}/${serviceName}`;
        } // Default case, use defaults if needed else adhere to input
        else {
          const host = svcObj.host ?? serverAddress;
          const port = svcObj.port ? `:${svcObj.port}` : "";
          const path = svcObj.path ? `/${svcObj.path}` : "";
          endpoint = `http://${host}${port}${path}`;
        }

        console.log(endpoint);

        return {
          displayName: serviceName,
          endpoint,
          icon: svcObj.icon ?? null,
          newtab: svcObj.newtab ?? null,
        };
      },
    ),
  }));
}

const eleContent = document.querySelector(".content");
const eleSidebar = document.querySelector(".sidebar");

/* ===============================
   Long-press + click handler
   =============================== */
function setupButtonActions(button, iframe, child) {
  let pressTimer = null;
  let longPressTriggered = false;
  const LONG_PRESS_MS = 500;

  const startPress = () => {
    longPressTriggered = false;
    pressTimer = setTimeout(() => {
      longPressTriggered = true;
      window.open(iframe.src, "_blank")?.focus();
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  // Mouse
  button.addEventListener("mousedown", startPress);
  button.addEventListener("mouseup", cancelPress);
  button.addEventListener("mouseleave", cancelPress);

  // Touch (Android / mobile)
  button.addEventListener("touchstart", startPress, { passive: true });
  button.addEventListener("touchend", cancelPress);
  button.addEventListener("touchcancel", cancelPress);

  // Click (short press)
  button.addEventListener("click", (event) => {
    if (longPressTriggered) return;

    if (event.ctrlKey || child.newtab) {
      window.open(iframe.src, "_blank")?.focus();
    } else {
      displayServiceIframe(iframe.id, button);
    }
  });
}

async function populateFromYaml() {
  const services = await loadServices();

  services.forEach((srv) => {
    const templateGroup = document.getElementById("template-group");
    const eleGroup = templateGroup.content.cloneNode(true);
    const eleGroupHeaderName = eleGroup.querySelector(".name");
    const eleGroupContent = eleGroup.querySelector(".group-content");

    eleGroupHeaderName.textContent = srv.displayName;

    srv.children.forEach((child) => {
      const templateService = document.getElementById("template-service-litem");
      const eleServiceMenuItem = templateService.content.cloneNode(true);
      const eleButton = eleServiceMenuItem.querySelector("button");

      const iframe = document.createElement("iframe");
      iframe.id = child.displayName.toLowerCase();
      iframe.src = child.endpoint;
      iframe.allow = "fullscreen";
      eleContent.appendChild(iframe);

      eleServiceMenuItem.querySelector("span").textContent = child.displayName;
      eleServiceMenuItem.querySelector("img").src = child.icon;

      eleButton.id = iframe.id + "-btn";
      eleButton.title = "Click: open • Long-press: new tab";

      setupButtonActions(eleButton, iframe, child);

      eleGroupContent.appendChild(eleServiceMenuItem);
    });

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
  document.querySelectorAll("iframe").forEach((f) =>
    f.classList.remove("active")
  );
  document.querySelectorAll(".sidebar button").forEach((b) =>
    b.classList.remove("active", "focused")
  );

  document.getElementById(id).classList.add("active");
  btnElem.classList.add("active", "focused");

  document.querySelector("#search").value = "";
  updateSearchFilter();

  const groupContent = btnElem.closest(".group-content");
  if (groupContent.classList.contains("collapsed")) {
    groupContent.classList.remove("collapsed");
    const arrow = groupContent.previousElementSibling.querySelector(
      "span:last-child",
    );
    if (arrow) arrow.textContent = "▼";
  }

  const url = new URL(window.location);
  url.searchParams.set("page", id);
  history.replaceState(null, "", url);
}

function updateSearchFilter() {
  const query = document.getElementById("search").value.toLowerCase();
  document.querySelectorAll(".group").forEach((group) => {
    let visible = 0;
    group.querySelectorAll("button").forEach((btn) => {
      const match = btn.innerText.toLowerCase().includes(query);
      btn.style.display = match ? "" : "none";
      if (match) visible++;
    });
    group.style.display = visible ? "" : "none";
  });
}

eleSidebar.addEventListener("keydown", (e) => {
  if (document.activeElement.tagName === "INPUT") return;

  const buttons = [...document.querySelectorAll(".sidebar button")]
    .filter((b) => b.offsetParent !== null);

  let current = buttons.findIndex((b) =>
    b.classList.contains("focused") || b.classList.contains("active")
  );

  if (["ArrowUp", "w", "W", "k", "K"].includes(e.key)) {
    e.preventDefault();
    current = (current - 1 + buttons.length) % buttons.length;
  } else if (["ArrowDown", "s", "S", "j", "J"].includes(e.key)) {
    e.preventDefault();
    current = (current + 1) % buttons.length;
  } else return;

  displayServiceIframe(
    buttons[current].id.replace("-btn", ""),
    buttons[current],
  );
});

function loadInitialIFrame() {
  eleSidebar.focus();
  const page = new URLSearchParams(window.location.search).get("page");
  const btn = (page && document.getElementById(page + "-btn")) ||
    document.querySelector(".sidebar button");

  if (btn) displayServiceIframe(btn.id.replace("-btn", ""), btn);
}

window.addEventListener("load", async () => {
  await populateFromYaml();
  loadInitialIFrame();
});

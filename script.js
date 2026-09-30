/* ============================================================
   SneakerPapi — Module 12: Shipping & Order Status Tracker
   Business Process: The system allows staff to track the progress
   of an ALREADY-EXISTING online order from preparation until
   delivery, so staff can answer customers asking about the status
   of their parcel.

   Data Structure: Finite State Machine (Enum List)
       RESERVED -> PROCESSING -> SHIPPED -> IN_TRANSIT -> DELIVERED
   Algorithm: State Transition Validation
   ============================================================ */

/* ---------- Enum List: order lifecycle states (Module 12 scope) ---------- */

const STATES = ["RESERVED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED"];

/* Short description shown under each state on the timeline */
const STATE_DESCRIPTIONS = {
    RESERVED:   "Stock reserved for this order",
    PROCESSING: "Order being prepared",
    SHIPPED:    "Handed to courier",
    IN_TRANSIT: "On the way to the customer",
    DELIVERED:  "Delivered to customer"
};

const MAX_STAGE_TIME = {
    RESERVED: 4 * 60 * 60 * 1000,        // 4 hours
    PROCESSING: 24 * 60 * 60 * 1000,     // 24 hours
    SHIPPED: 24 * 60 * 60 * 1000,        // 24 hours
    IN_TRANSIT: 72 * 60 * 60 * 1000      // 72 hours
};

/* A plain JS Map is used only as a convenient internal lookup table
   (Order ID -> Order Record). It is NOT the module's conceptual data
   structure — that is the Finite State Machine / Enum List above —
   so it is never shown to the user as "the data structure". */
const OrderMap = new Map();

/* Seeded demonstration order.
   This order already went through Module 10 (created) and
   Module 11 (down payment + reservation), so it starts partway
   through the Module 12 flow with realistic prior timestamps
   already in its history. Its status is left at SHIPPED (rather
   than DELIVERED) so it can still be used to demo further valid
   and invalid transitions with the form.
   History entries store { from, to, timestamp } so the timeline
   can show real dates/times instead of plain text arrows. */
OrderMap.set("ORD-2026-901", {
    orderId: "ORD-2026-901",
    customer: "Juan Dela Cruz",
    itemName: "Nike Dunk Size 41",
    courier: "J&T Express",
    trackingNumber: "JT99201823",
    status: "RESERVED",
    history: [
        { from: "UNPAID", to: "RESERVED", timestamp: "2026-09-21T10:15:00" }
    ]
});

/* ---------- DOM References ---------- */

const form          = document.getElementById("trackingForm");
const trackerPanel  = document.getElementById("trackerPanel");
const outputBox      = document.getElementById("outputContainer");
const stateFlowView   = document.getElementById("stateFlow");

/* ---------- Small helpers ---------- */

/* Turns "2026-09-21T15:40:00" into "Sept. 21, 2026 • 3:40 PM" */
function formatTimestamp(isoString) {
    const d = new Date(isoString);
    const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June",
                     "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;

    return month + " " + day + ", " + year + " \u2022 " + hours + ":" + minutes + " " + ampm;
}

/* Current timestamp in the same ISO shape used by history entries.
   This is how the system automatically records WHEN a transition
   happened, so staff never have to type a date/time by hand. */
function nowIso() {
    const d = new Date();
    const p = v => String(v).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
           "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

/* Finds the most recent history entry that transitioned into the given state */
function timestampFor(order, state) {
    for (let i = order.history.length - 1; i >= 0; i--) {
        if (order.history[i].to === state) return order.history[i].timestamp;
    }
    return null;
}

function isStageDelayed(order) {
    const enteredAt = timestampFor(order, order.status);

    if (!enteredAt || !MAX_STAGE_TIME[order.status]) {
        return false;
    }

    const elapsed = Date.now() - new Date(enteredAt).getTime();

    return elapsed > MAX_STAGE_TIME[order.status];
}

function nextValidState(currentState) {
    const idx = STATES.indexOf(currentState);
    return idx < STATES.length - 1 ? STATES[idx + 1] : null;
}

/* Horizontal position (in %) of a state's node along the timeline.
   Each state owns an equal-width column, and the node sits at the
   center of its column — this is reused for both the timeline
   markers and the running-sneaker indicator so they always line up. */
function statePercent(index) {
    return ((index + 0.5) / STATES.length) * 100;
}

/* Basic, beginner-level format check for a freshly-entered tracking
   number. This does NOT validate against a real courier database —
   it just checks the value looks like a reasonable tracking code. */
function looksLikeTrackingNumber(value) {
    return /^[A-Za-z0-9-]{6,20}$/.test(value);
}

/* ---------- Algorithm: State Transition Validation ---------- */

form.addEventListener("submit", function (e) {
    e.preventDefault();

    const orderId     = document.getElementById("orderId").value.trim();
    const trackingNo   = document.getElementById("trackingNo").value.trim();
    const newState     = document.getElementById("newState").value;

    /* Order ID cannot be blank (the "required" attribute on the
       input already prevents most of this, but we check again here). */
    if (!orderId) {
        renderError("ORDER ID REQUIRED", "Please enter an Order ID before updating a status.");
        return;
    }

    /* STEP 1: Find the order using Order ID (lookup by key) */
    const order = OrderMap.get(orderId);
    if (!order) {
        renderError("ORDER NOT FOUND", "Order ID \"" + orderId + "\" does not exist.");
        return;
    }

    /* A DELIVERED order is a terminal state in the Finite State Machine —
       nothing else is allowed to follow it. */
    if (order.status === "DELIVERED") {
        renderError(
            "ORDER ALREADY DELIVERED",
            "Order " + order.orderId + " has already been delivered. Its status cannot be changed further."
        );
        return;
    }

    /* Tracking number checks:
       - If the order has none on file yet, one is required.
       - If the order already has one on file, a DIFFERENT value is
         rejected instead of silently overwriting the existing record.
       - A brand-new tracking number gets a basic format check. */
    if (!trackingNo && !order.trackingNumber) {
        renderError(
            "TRACKING NUMBER REQUIRED",
            "This order has no tracking number on file yet. Please enter one before updating its status."
        );  
        return;
    }

    if (trackingNo && order.trackingNumber && trackingNo !== order.trackingNumber) {
        renderError(
            "TRACKING NUMBER MISMATCH",
            "The tracking number you entered does not match the existing shipment record for order " +
            order.orderId + ". On file: " + order.trackingNumber + "."
        );
        return;
    }

    if (trackingNo && !order.trackingNumber && !looksLikeTrackingNumber(trackingNo)) {
        renderError(
            "INVALID TRACKING NUMBER FORMAT",
            "Tracking numbers should be 6\u201320 letters, numbers, or dashes. Please double-check the value and try again."
        );
        return;
    }

    /* Determine current state and selected new state */
    const currentIndex = STATES.indexOf(order.status);
    const targetIndex   = STATES.indexOf(newState);

    if (isStageDelayed(order)) {
    console.warn(
        "STAGE DELAY:",
        order.orderId,
        "has been in",
        order.status,
        "longer than expected."
    );
}

    /* STEP 4: Check whether the selected state is exactly the next valid state */
    if (newState === order.status) {
    if (newState === "RESERVED") {
        renderTracker(order);

        outputBox.innerHTML = `
            <div class="success-banner">
                <span>Order ${order.orderId} is currently in state RESERVED.</span>
            </div>
        `;

        return;
    }

    renderError(
        "INVALID TRANSITION",
        "Order " + order.orderId + " is already in state " + newState + "."
    );
    return;
}

    if (targetIndex < currentIndex) {
        renderError(
            "INVALID TRANSITION",
            "Orders cannot move backward. " + order.status + " cannot go back to " + newState + "."
        );
        return;
    }

    if (targetIndex > currentIndex + 1) {
        const skipped = STATES.slice(currentIndex + 1, targetIndex).join(" and ");
        renderError(
            "INVALID TRANSITION",
            "You cannot skip from " + order.status + " to " + newState +
            ".<br>Cannot skip " + skipped + ".<br><br>Next valid status: <strong>" +
            nextValidState(order.status) + "</strong>"
        );
        return;
    }

    /* Valid transition from here on */
    const previousState = order.status;
    const previousIndex = currentIndex;
    const timestamp = nowIso();

    /* Update Order.status */
    order.status = newState;

    /* Record the timestamp and add the transition to history */
    order.history.push({ from: previousState, to: newState, timestamp: timestamp });

    /* Attach the tracking number if this is the first time one
       is being provided, otherwise keep the tracking number already on file. */
    if (trackingNo && !order.trackingNumber) {
        order.trackingNumber = trackingNo;
    }

    /* Clear the tracking number field after use so it doesn't look
       like it still needs to be retyped next time. */
    document.getElementById("trackingNo").value = "";

    /* Re-render the timeline (with the sneaker animating from
       its old position to the new one) and the order information. */
    renderTracker(order, previousIndex);
    renderSuccess(previousState, newState);
});

/* Output: Order Tracking Timeline (always visible) */

/* animateFromIndex is optional. When given, the running-sneaker icon
   starts at that state's position and animates over to the order's
   current state, instead of just appearing there instantly. */
function renderTracker(order, animateFromIndex) {
    const currentIndex = STATES.indexOf(order.status);

    let html = "";

    /* Order information table */
    html += "<h3>Order Information</h3>";
    html += "<table>" +
        "<tr><td>Order ID</td><td>" + order.orderId + "</td></tr>" +
        "<tr><td>Customer</td><td>" + order.customer + "</td></tr>" +
        "<tr><td>Item</td><td>" + order.itemName + "</td></tr>" +
        "<tr><td>Courier</td><td>" + order.courier + "</td></tr>" +
        "<tr><td>Tracking #</td><td>" + (order.trackingNumber || "\u2014 none yet \u2014") + "</td></tr>" +
        "<tr><td>Current Status</td><td><span class=\"status-pill " + order.status + "\">" +
            order.status.replace("_", " ") + "</span></td></tr>" +
    "</table>";

    /* Horizontal order tracking path */
    html += "<h3>Order Tracking Path</h3>";
    html += "<div class=\"tt-wrap\"><div class=\"tt-track\">";

    html += "<div class=\"tt-nodes\">";
    STATES.forEach(function (state, i) {
        let cls, icon;
        if (i < currentIndex) {
            cls = "done";
            icon = "&#10003;"; /* check mark */
        } else if (i === currentIndex) {
            cls = "current";
            icon = "&#9679;"; /* filled dot */
        } else {
            cls = "upcoming";
            icon = "&#9675;"; /* hollow dot */
        }

        const ts = timestampFor(order, state);
        const timeLabel = ts ? formatTimestamp(ts) : "Pending";

        html += "<div class=\"tt-node " + cls + "\">" +
            "<div class=\"tt-marker\">" + icon + "</div>" +
            "<div class=\"tt-label\">" + state.replace("_", " ") + "</div>" +
            "<div class=\"tt-desc\">" + STATE_DESCRIPTIONS[state] + "</div>" +
            "<div class=\"tt-time\">" + timeLabel + "</div>" +
        "</div>";
    });
    html += "</div>"; /* .tt-nodes */

    html += "<div class=\"tt-bar-row\">" +
        "<div class=\"tt-bar-line\"></div>" +
        "<div class=\"tt-sneaker\" id=\"sneakerIcon\" style=\"left:" + statePercent(currentIndex) + "%\">&#128095;</div>" +
    "</div>";

    html += "<div class=\"tt-sneaker-caption\">Order currently traveling toward: <strong>" +
        order.status.replace("_", " ") + "</strong></div>";

    html += "</div></div>"; /* .tt-track, .tt-wrap */

    trackerPanel.innerHTML = html;

    if (animateFromIndex !== undefined && animateFromIndex !== null && animateFromIndex !== currentIndex) {
        const sneaker = document.getElementById("sneakerIcon");
        sneaker.style.left = statePercent(animateFromIndex) + "%";
        /* Double requestAnimationFrame forces the browser to paint the
           starting position first, THEN apply the new position so the
           CSS transition on "left" actually has something to animate. */
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                sneaker.style.left = statePercent(currentIndex) + "%";
            });
        });
    }
}

/* Output: Transition confirmation banner */

function renderSuccess(previousState, newState) {
    outputBox.innerHTML =
        "<div class=\"status-banner success\">" +
            "<div class=\"banner-title\">\u2713 STATUS UPDATED</div>" +
            "<div class=\"banner-body\">" + previousState.replace("_", " ") +
                " \u2192 " + newState.replace("_", " ") + "</div>" +
        "</div>";
}

/* Output: Invalid transition / validation error banner */

function renderError(title, message) {
    outputBox.innerHTML =
        "<div class=\"status-banner error\">" +
            "<div class=\"banner-title\">" + title + "</div>" +
            "<div class=\"banner-body\">" + message + "</div>" +
        "</div>";
    /* The timeline/order info in trackerPanel is intentionally left
       untouched here, since an invalid transition must not change
       the order's recorded state. */
}

/* Init: page should look like a working tracker immediately  */

const seededOrder = OrderMap.get("ORD-2026-901");
outputBox.innerHTML =
    "<p>No status update submitted yet. Enter the Order ID, an optional tracking number, and the new state, then press <strong>Update Order Status</strong>.</p>";
renderStateFlow();

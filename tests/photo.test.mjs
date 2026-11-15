import test from "node:test";
import assert from "node:assert/strict";
import { isPhotoData, MAX_PHOTO_CHARS } from "../src/photo.js";
import { cleanWaypointMetadata } from "../src/waypoint-editor.js";

test("only small JPEG pictures are accepted as waypoint photos", () =>
{
    assert.equal(isPhotoData("data:image/jpeg;base64,/9j/4AAQSkZJRg=="), true);
    assert.equal(isPhotoData("data:image/png;base64,iVBORw0KGgo="), false);
    assert.equal(isPhotoData("https://example.com/x.jpg"), false);
    assert.equal(isPhotoData("data:image/jpeg;base64," + "A".repeat(MAX_PHOTO_CHARS)), false);
    assert.equal(isPhotoData("data:image/jpeg;base64,<script>"), false);
});

test("waypoint metadata keeps a good photo, drops a bad one and removes on request", () =>
{
    const good = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    assert.equal(cleanWaypointMetadata({ photo: good }).photo, good);
    assert.equal("photo" in cleanWaypointMetadata({ photo: "javascript:alert(1)" }), false);
    assert.equal(cleanWaypointMetadata({ photo: null }).photo, null);
});

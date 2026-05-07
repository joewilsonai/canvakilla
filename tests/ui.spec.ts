import { expect, test, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

async function writeTinyImage(testInfo: TestInfo, fileName: string) {
  const filePath = testInfo.outputPath(fileName);
  await writeFile(filePath, Buffer.from(TINY_PNG, "base64"));
  return filePath;
}

test("X preflight makes parked versus clicked references explicit", async ({
  page,
}, testInfo) => {
  await page.goto("/x");

  const preflight = page.getByLabel("Next generation source");
  await expect(preflight).toContainText("Prompt only");
  await expect(page.getByRole("button", { name: /Create Banner/i })).toBeVisible();

  const referencePath = await writeTinyImage(testInfo, "x-reference.png");
  await page.locator(".upload-zone input").setInputFiles(referencePath);

  await expect(page.getByRole("button", { name: /R1/ })).toContainText(
    "Parked until clicked",
  );
  await expect(preflight).toContainText("1 parked ref not sent");

  await page.getByRole("button", { name: /R1/ }).click();

  await expect(preflight).toContainText("Clicked refs only");
  await expect(preflight).toContainText("1 clicked ref sent");
  await expect(page.getByRole("button", { name: /Create Banner/i })).toBeVisible();
});

test("LinkedIn profile source can be moved back to references without deletion", async ({
  page,
}, testInfo) => {
  await page.goto("/linkedin");
  await page.locator(".target-switch").getByRole("button", { name: "Profile" }).click();

  const profilePath = await writeTinyImage(testInfo, "linkedin-profile.png");
  await page.locator(".profile-upload input").setInputFiles(profilePath);

  await expect(
    page.getByRole("button", {
      name: /Move current LinkedIn profile photo out of preview and into references/i,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Next generation source")).toContainText(
    "Current LinkedIn profile photo",
  );

  await page
    .getByRole("button", {
      name: /Move current LinkedIn profile photo out of preview and into references/i,
    })
    .click();

  await expect(page.getByText("moved-profile.png")).toBeVisible();
  await expect(page.getByText("LinkedIn profile photo moved to references")).toBeVisible();
  await expect(page.getByLabel("Next generation source")).toContainText("Prompt only");
  await expect(page.getByLabel("Next generation source")).toContainText(
    "1 parked ref not sent",
  );
});

test("LinkedIn typography prompts still use the selected image model", async ({
  page,
}) => {
  let apiRequestBody = "";

  await page.route("**/api/generate", async (route) => {
    apiRequestBody = route.request().postDataBuffer()?.toString("utf8") || "";
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        imageBase64: TINY_PNG,
        mimeType: "image/png",
        model: "openai/gpt-5.4-image-2",
        provider: "openrouter",
      }),
    });
  });

  await page.goto("/linkedin");
  await page.getByLabel("Model").selectOption("openai/gpt-5.4-image-2");
  await page.getByLabel(/Next LinkedIn banner edit/i).fill(`
Create a professional LinkedIn cover banner in a wide 4:1 layout.
Main text on the right-center: "not just talking about AI. shipping it."
Under the divider, add smaller muted-gray monospace text:
"microsoft → amazon → rapsodo → solo"
  `);
  await page.getByRole("button", { name: /Create Banner/i }).click();

  await expect(page.getByText("Banner result loaded for next iteration")).toBeVisible();
  expect(apiRequestBody).toContain('name="model"');
  expect(apiRequestBody).toContain("openai/gpt-5.4-image-2");
  await expect(
    page.getByRole("button", { name: /Iterate Current Banner/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Start fresh: park current/i }).click();
  await expect(page.getByLabel("Next generation source")).toContainText("Prompt only");
  await expect(page.getByLabel("Next generation source")).toContainText(
    "1 parked ref not sent",
  );
  await expect(
    page.getByText("Typography-safe banner rendered from the prompt"),
  ).not.toBeVisible();
});

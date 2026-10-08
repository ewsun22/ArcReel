import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { API } from "@/api";
import { LeaveGuardProvider } from "@/components/shared/edit-unit/LeaveGuard";
import { useAppStore } from "@/stores/app-store";
import { useProjectsStore } from "@/stores/projects-store";
import type { ProjectData } from "@/types";
import { AssetGallery } from "./AssetGallery";
import type { GalleryAssetSource } from "./gallery-model";

const HINT = "参考图只用于生成资产图，分镜和视频使用的是资产图";
const STALE = "参考图已更新，点「重新生成资产图」后才会生效";

let server: ProjectData;

function makeProject(): ProjectData {
  return {
    title: "Demo",
    content_mode: "drama",
    style: "Anime",
    episodes: [],
    characters: {
      张翠花: {
        description: "烦躁刻薄",
        voice_style: "",
        character_sheet: "characters/张翠花.png",
        reference_image: "characters/refs/张翠花.png",
      },
    },
    scenes: {},
    props: {},
    products: {},
  };
}

function Harness() {
  const project = useProjectsStore((s) => s.currentProjectData);
  return (
    <AssetGallery
      projectName="demo"
      assetType="character"
      title="角色"
      assets={(project?.characters ?? {}) as Record<string, GalleryAssetSource>}
      readOnly={false}
      onGenerate={vi.fn()}
    />
  );
}

function renderGallery() {
  const location = memoryLocation({ path: "/", record: true });
  render(
    <Router hook={location.hook}>
      <LeaveGuardProvider>
        <Harness />
      </LeaveGuardProvider>
    </Router>,
  );
}

describe("角色详情：参考图待生效", () => {
  beforeEach(() => {
    server = makeProject();
    useAppStore.setState(useAppStore.getInitialState(), true);
    useProjectsStore.setState({ currentProjectName: "demo", currentProjectData: structuredClone(server) });
    vi.spyOn(API, "getProject").mockImplementation(() =>
      Promise.resolve({ project: structuredClone(server), scripts: {} }),
    );
    vi.spyOn(API, "getAssetSheetStatus").mockResolvedValue({ assets: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useProjectsStore.setState(useProjectsStore.getInitialState(), true);
  });

  it("prompts regenerating after a same-path reference replacement and clears on a new sheet", async () => {
    const user = userEvent.setup();
    vi.spyOn(API, "uploadFile").mockResolvedValue({ success: true } as never);
    renderGallery();
    await user.click(screen.getByRole("button", { name: "张翠花" }));
    const sheet = await screen.findByRole("dialog", { name: "张翠花" });
    expect(within(sheet).getByText(HINT)).toBeInTheDocument();

    const input = sheet.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["ref"], "ref.png", { type: "image/png" })] } });
    });
    expect(await within(sheet).findByText(STALE)).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "重新生成资产图" }).closest("[data-reference-stale]")).not.toBeNull();

    act(() => useProjectsStore.getState().updateAssetFingerprints({ "characters/张翠花.png": Date.now() }));
    expect(within(sheet).getByText(HINT)).toBeInTheDocument();
    expect(within(sheet).queryByText(STALE)).not.toBeInTheDocument();
  });
});

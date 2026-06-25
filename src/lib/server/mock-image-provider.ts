import { editMockResults, posterMockResults } from "@/lib/mock-data";
import type { ImageProviderService } from "@/lib/server/image-provider";

export function createMockImageProvider(): ImageProviderService {
  return {
    name: "mock",
    async editImage() {
      return { url: editMockResults[0].url };
    },
    async generateImage() {
      return { url: posterMockResults[0].url };
    },
    async removeBackground() {
      return { url: editMockResults[0].url };
    }
  };
}

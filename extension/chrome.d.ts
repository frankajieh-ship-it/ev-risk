/**
 * Minimal Chrome extension API type declarations.
 * Covers the APIs used by this extension.
 */

declare namespace chrome {
  namespace runtime {
    function sendMessage(message: any, responseCallback?: (response: any) => void): void;
    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: any) => void
        ) => void
      ): void;
    };
    const onInstalled: {
      addListener(callback: (details: { reason: string }) => void): void;
    };
    interface MessageSender {
      tab?: chrome.tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
    }
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
    }
    function create(createProperties: { url: string }): void;
  }

  namespace storage {
    interface StorageArea {
      get(keys: string[], callback: (items: Record<string, any>) => void): void;
      set(items: Record<string, any>, callback?: () => void): void;
    }
    const local: StorageArea;
  }
}

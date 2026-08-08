export interface RuntimeMessageSender {
  readonly id?: string;
}

export type RuntimeMessageHandler = (
  message: unknown,
  sender: RuntimeMessageSender
) => Promise<unknown>;

export interface RuntimeApi {
  readonly id: string;
  readonly onMessage: {
    addListener(
      listener: (
        message: unknown,
        sender: RuntimeMessageSender,
        sendResponse: (response: unknown) => void
      ) => boolean
    ): void;
  };
}

export function registerAsyncRuntimeMessageHandler(
  runtime: RuntimeApi,
  handler: RuntimeMessageHandler
): void {
  runtime.onMessage.addListener((message, sender, sendResponse) => {
    void handler(message, sender)
      .then(sendResponse)
      .catch(() => sendResponse(null));

    return true;
  });
}

export function getChromeRuntime(): RuntimeApi {
  return chrome.runtime as unknown as RuntimeApi;
}

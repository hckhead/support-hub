{
    "id": "chatcmpl-3a9c3572f29311efa69751e139332ced",
    "choices": [
        {
            "delta": {
                "content": "This is a test. If you have any specific questions or need information, feel",
                "role": "assistant",
                "function_call": null,
                "tool_calls": null
            },
            "finish_reason": null,
            "index": 0,
            "logprobs": null
        }
    ],
    "created": 1740543996,
    "model": "model",
    "object": "chat.completion.chunk",
    "system_fingerprint": "",
    "usage": null
}
// omit duplicated information
{"choices":[{"delta":{"content":" free to ask, and I will do my best to provide an answer based on","role":"assistant"}}]}
{"choices":[{"delta":{"content":" the knowledge I have. If your question is unrelated to the provided knowledge base,","role":"assistant"}}]}
{"choices":[{"delta":{"content":" I will let you know.","role":"assistant"}}]}
// the last chunk
{
    "id": "chatcmpl-3a9c3572f29311efa69751e139332ced",
    "choices": [
        {
            "delta": {
                "content": null,
                "role": "assistant",
                "function_call": null,
                "tool_calls": null
            },
            "finish_reason": "stop",
            "index": 0,
            "logprobs": null
        }
    ],
    "created": 1740543996,
    "model": "model",
    "object": "chat.completion.chunk",
    "system_fingerprint": "",
    "usage": {
        "prompt_tokens": 18,
        "completion_tokens": 225,
        "total_tokens": 243
    }
}
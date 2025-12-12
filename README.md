# PDF API

A Node.js API that generates PDFs using pdfmake and returns them as base64 encoded strings.

## Installation

```bash
npm install
```

## Running the Server

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check

```
GET /health
```

### Generate Sample PDF

```
GET /api/generate-pdf
```

Returns a sample PDF as base64.

### Generate Custom PDF

```
POST /api/generate-pdf
Content-Type: application/json

{
  "title": "My Custom Title",
  "content": "My custom content here...",
  "author": "John Doe"
}
```

## Response Format

```json
{
  "success": true,
  "message": "PDF generated successfully",
  "data": {
    "base64": "JVBERi0xLjMK...",
    "mimeType": "application/pdf"
  }
}
```

## Using the Base64 Response

### In Browser (Download)

```javascript
const base64 = response.data.base64;
const link = document.createElement("a");
link.href = `data:application/pdf;base64,${base64}`;
link.download = "document.pdf";
link.click();
```

### In Browser (View in iframe)

```javascript
const base64 = response.data.base64;
iframe.src = `data:application/pdf;base64,${base64}`;
```

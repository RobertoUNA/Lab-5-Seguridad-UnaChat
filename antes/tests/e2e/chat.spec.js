// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Pruebas End-to-End (E2E) con Playwright - UNA Chat', () => {

  test.beforeEach(async ({ page }) => {
    // Navegar a la raiz de la aplicacion UNA Chat
    await page.goto('/');
  });

  test('1. Enviar una URL de imagen y verificar que se muestra y carga en el chat', async ({ page }) => {
    const imageUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png';

    // Rellenar Username y Mensaje con selectores solicitados
    await page.getByPlaceholder('Username').fill('UsuarioImagen');
    await page.getByPlaceholder('Escriba un mensaje').fill(imageUrl);

    // Hacer clic en el boton Send usando getByRole
    await page.getByRole('button', { name: 'Send' }).click();

    // Localizar la imagen dentro de la lista de mensajes
    const chatImage = page.locator('#messages img').last();

    // Verificar que la imagen es visible en el DOM
    await expect(chatImage).toBeVisible({ timeout: 10000 });
    await expect(chatImage).toHaveAttribute('src', imageUrl);

    // Verificar que la imagen termina de cargar correctamente (naturalWidth > 0)
    await expect.poll(async () => {
      return await chatImage.evaluate((img) => /** @type {HTMLImageElement} */ (img).naturalWidth > 0);
    }).toBe(true);
  });

  test('2. Enviar una URL de video y verificar que el reproductor aparece y carga contenido', async ({ page }) => {
    const videoUrl = 'https://www.youtube.com/watch?v=qYwlqx-JLok';

    await page.getByPlaceholder('Username').fill('UsuarioVideo');
    await page.getByPlaceholder('Escriba un mensaje').fill(videoUrl);

    // Enviar el formulario
    await page.getByRole('button', { name: 'Send' }).click();

    // Localizar el iframe del video embebido en el chat
    const chatIframe = page.locator('#messages iframe').last();

    // Verificar que el iframe aparece en pantalla
    await expect(chatIframe).toBeVisible({ timeout: 10000 });

    // Verificar que la fuente apunta al video de YouTube
    await expect(chatIframe).toHaveAttribute('src', /https:\/\/www\.youtube\.com\/embed\/qYwlqx-JLok/);
  });

  test('3. Enviar script malicioso: verificar prevencion de XSS y saneamiento del mensaje', async ({ page }) => {
    let dialogTriggered = false;
    let dialogMessage = '';

    // Registrar listener page.on("dialog") ANTES del envio para detectar cualquier intento de alert
    page.on('dialog', async (dialog) => {
      dialogTriggered = true;
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    const scriptPayload = "<script>alert('Inyección de script');</script>";

    await page.getByPlaceholder('Username').fill('HackerPrueba');
    await page.getByPlaceholder('Escriba un mensaje').fill(scriptPayload);

    // Enviar el mensaje con el script malicioso
    await page.getByRole('button', { name: 'Send' }).click();

    // Esperar a que el mensaje aparezca en la lista
    const lastMessage = page.locator('#messages li').last();
    await expect(lastMessage).toBeVisible({ timeout: 10000 });

    // Comprobar que NINGUN alert/dialog se ejecuto
    expect(dialogTriggered).toBe(false);

    // Comprobar que no se inyecto ninguna etiqueta <script> ejecutable en el DOM
    const scriptTagsInChat = await page.locator('#messages script').count();
    expect(scriptTagsInChat).toBe(0);

    // Comprobar el saneamiento del mensaje (se muestra como texto neutralizado)
    const textContent = await lastMessage.textContent();
    expect(textContent).toContain("alert('Inyección de script');");
  });

});

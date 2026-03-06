from PIL import Image

def make_transparent(img_path, output_path):
    img = Image.open(img_path)
    img = img.convert("RGBA")
    datas = img.getdata()

    newData = []
    # O fundo parece ser um cinza claro. Vamos pegar a cor do pixel (0,0) como referência
    bg_color = datas[0]
    
    for item in datas:
        # Se o pixel for muito parecido com o fundo (ou muito claro), torna transparente
        # Checando distância Euclidiana básica ou apenas threshold
        if abs(item[0] - bg_color[0]) < 30 and abs(item[1] - bg_color[1]) < 30 and abs(item[2] - bg_color[2]) < 30:
            newData.append((255, 255, 255, 0))
        elif item[0] > 220 and item[1] > 220 and item[2] > 220: # Quase branco
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    make_transparent("soldier.png", "soldier_transparent.png")

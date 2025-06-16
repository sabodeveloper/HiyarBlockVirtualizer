"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { createPublicClient, http, defineChain } from 'viem';

// Monad Testnet için özel zincir tanımı
const monadTestnet = defineChain({
  id: 10143, // Chain ID
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://monad-testnet.g.alchemy.com/v2/8QMlEIAdNyu3vAlf8e7XhoyRRwBiaFr5'] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com/' },
  },
  testnet: true,
});

interface PixiSpriteProps {
  isGamePage?: boolean;
  account?: string | null;
}

const PixiSprite = ({ isGamePage = false, account }: PixiSpriteProps) => {
  const pixiContainer = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const spriteRef = useRef<PIXI.Sprite | null>(null);
  const bossRef = useRef<PIXI.AnimatedSprite | null>(null);
  const containerRef = useRef<PIXI.Container | null>(null);
  const mainContainerRef = useRef<PIXI.Container | null>(null);
  const bulletTextureRef = useRef<PIXI.Texture | null>(null);
  const bulletsRef = useRef<PIXI.Sprite[]>([]);
  const isFiringRef = useRef(false);
  const fireIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fireTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fireSpriteRef = useRef<PIXI.AnimatedSprite | null>(null);
  const bossAngryRef = useRef<PIXI.AnimatedSprite | null>(null);
  const lastKnownBlockNumberRef = useRef<bigint | null>(null); // useRef'i buraya taşıdım

  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);

  // Viem client oluştur
  const client = createPublicClient({
    chain: monadTestnet, // Monad testnet chain bilgileriyle güncelledim
    transport: http(), // RPC URL'si chain objesi içinden alınacak
  });

  // Mermi oluşturma fonksiyonu
  const createBullet = useCallback(() => {
    if (!containerRef.current || !bulletTextureRef.current || !mainContainerRef.current || !appRef.current) return;
    
    const bullet = new PIXI.Sprite(bulletTextureRef.current);
    bullet.anchor.set(0.5);
    bullet.x = containerRef.current.x;
    bullet.y = containerRef.current.y;
    bullet.scale.set(0.05);
    
    // Karakterin yönü artık sabit olacak, bu yüzden Math.sign(spriteRef.current?.scale.x || 1) yerine 1 kullanabiliriz veya karakterin ilk ateş karesinin yönünü alabiliriz.
    // Şimdilik 1 olarak bırakıyorum (sağ taraf).
    const direction = 1;
    bullet.scale.x = direction * 0.05;
    
    if (direction > 0) {
      bullet.rotation = Math.PI;
    }
    
    appRef.current.stage.addChild(bullet);
    bulletsRef.current.push(bullet);

    const bulletSpeed = 15;
    const updateBullet = () => {
      if (!bullet || !appRef.current || bullet.destroyed) return;

      bullet.x += bulletSpeed * direction;

      // Boss ile çarpışma kontrolü
      if (bossRef.current && 
          bullet.x > bossRef.current.x - 100 && 
          bullet.x < bossRef.current.x + 100 &&
          bullet.y > bossRef.current.y - 150 &&
          bullet.y < bossRef.current.y + 150) {
        
        if (appRef.current?.ticker) {
          appRef.current.ticker.remove(updateBullet);
        }

        bulletsRef.current = bulletsRef.current.filter(b => b !== bullet);

        if (!bullet.destroyed && appRef.current && appRef.current.stage) {
          try {
            appRef.current.stage.removeChild(bullet);
            bullet.destroy();
          } catch (error) {
            console.warn("Mermi temizlenirken hata:", error);
          }
        }

        // Boss'a vurulduğunda angry animasyonu oynat
        if (bossRef.current && bossAngryRef.current) {
          bossRef.current.visible = false;
          bossRef.current.stop();
          bossAngryRef.current.visible = true;
          bossAngryRef.current.play();
          bossAngryRef.current.onComplete = () => {
            if (bossAngryRef.current) {
              bossAngryRef.current.visible = false;
              bossAngryRef.current.gotoAndStop(0);
            }
            if (bossRef.current) {
              bossRef.current.visible = true;
              bossRef.current.play();
            }
          };
        }
        
        return;
      }

      // Ekran dışına çıkma kontrolü
      if (bullet.x < 0 || bullet.x > (appRef.current?.screen.width || 0)) {
        if (appRef.current?.ticker) {
          appRef.current.ticker.remove(updateBullet);
        }

        bulletsRef.current = bulletsRef.current.filter(b => b !== bullet);

        if (!bullet.destroyed && appRef.current && appRef.current.stage) {
          try {
            appRef.current.stage.removeChild(bullet);
            bullet.destroy();
          } catch (error) {
            console.warn("Mermi temizlenirken hata:", error);
          }
        }
      }
    };

    if (appRef.current?.ticker) {
      appRef.current.ticker.add(updateBullet);
    }
  }, [containerRef, bulletTextureRef, mainContainerRef, appRef, bulletsRef, bossRef, bossAngryRef]);

  // Ateş etme fonksiyonları
  const startFiring = useCallback(() => {
    console.log("startFiring: Fonksiyon çağrıldı.");
    console.log("startFiring: isFiringRef.current=", isFiringRef.current, "containerRef.current=", !!containerRef.current);
    if (!containerRef.current) {
      console.log("startFiring: Container referansı mevcut değil. Ateş edilemiyor.");
      return;
    }
    if (isFiringRef.current) {
      console.log("startFiring: Zaten ateş ediliyor. Yeni bir ateşleme tetiklenmedi.");
      return;
    }
    
    isFiringRef.current = true;
    console.log("startFiring: isFiringRef.current TRUE olarak ayarlandı.");
    
    setTimeout(() => {
      isFiringRef.current = false;
    }, 500); // 500ms sonra sıfırla
    
    if (fireSpriteRef.current && spriteRef.current) {
        console.log("startFiring: Karakter ve ateş sprite'ları mevcut. Animasyon başlatılıyor.");
        const direction = Math.sign(spriteRef.current.scale.x); 
        spriteRef.current.visible = false; 
        fireSpriteRef.current.visible = true;
        fireSpriteRef.current.scale.x = Math.abs(fireSpriteRef.current.scale.x) * direction;
        fireSpriteRef.current.gotoAndPlay(0);
        console.log("startFiring: Karakter gizlendi, ateş animasyonu görünür yapıldı ve başlatıldı.");

        createBullet();
        console.log("startFiring: createBullet() çağrıldı.");

        if (fireSpriteRef.current) {
          fireSpriteRef.current.onComplete = () => {
            console.log("startFiring: Ateş animasyonu tamamlandı (onComplete).");
            if (fireSpriteRef.current) {
              fireSpriteRef.current.gotoAndStop(fireSpriteRef.current.totalFrames - 1);
              fireSpriteRef.current.visible = false; 
              console.log("startFiring: Ateş animasyonu gizlendi.");
            }
            if (spriteRef.current) {
              spriteRef.current.visible = true; 
              console.log("startFiring: Karakter tekrar görünür yapıldı.");
            }
          };
        }
      } else {
        console.log("startFiring: fireSpriteRef.current veya spriteRef.current mevcut değil. Ateş edilemiyor.");
        isFiringRef.current = false; // Hata durumunda isFiringRef'i sıfırla
      }
  }, [createBullet]);

  const stopFiring = () => {
    isFiringRef.current = false;
    console.log("stopFiring: isFiringRef.current FALSE olarak ayarlandı.");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pixiContainer.current) return;
    if (appRef.current) return;

    console.log("useEffect [PIXI Init]: PIXI uygulaması başlatılıyor...");

    import('pixi.js').then(async (PIXI) => {
      try {
        const app = new PIXI.Application({
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: 0x000000,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          backgroundAlpha: 1,
          clearBeforeRender: false,
        });

        app.renderer.events.autoPreventDefault = false;
        if (app.renderer.view instanceof HTMLCanvasElement) {
          app.renderer.view.style.imageRendering = 'pixelated';
          app.renderer.view.style.position = 'fixed';
          app.renderer.view.style.top = '0';
          app.renderer.view.style.left = '0';
        }
        app.stage.cullable = true;
        app.stage.eventMode = 'static';
        app.stage.interactive = true;

        appRef.current = app;
        pixiContainer.current?.appendChild(app.view as HTMLCanvasElement);
        console.log("useEffect [PIXI Init]: PIXI uygulaması yüklendi ve sahneye eklendi.");

        const mainContainer = new PIXI.Container();
        app.stage.addChild(mainContainer);
        mainContainerRef.current = mainContainer;
        console.log("useEffect [PIXI Init]: Ana container oluşturuldu.");

        // Arka plan texture'ını yükle
        const backgroundTexture = await PIXI.Assets.load('/background.png');
        const background = new PIXI.Sprite(backgroundTexture);
        background.anchor.set(0);
        background.width = app.screen.width;
        background.height = app.screen.height;
        const colorMatrix = new PIXI.filters.ColorMatrixFilter();
        background.filters = [colorMatrix];
        colorMatrix.brightness(0.6, false); // Parlaklığı %60'a düşür
        colorMatrix.saturate(0.5, true); // Doygunluğu %50 azalt
        mainContainer.addChild(background);
        console.log("useEffect [PIXI Init]: Arka plan yüklendi ve filtrelendi.");

        // Zemin texture'ını yükle
        const groundTexture = await PIXI.Assets.load('/floor.png');
        const ground = new PIXI.Sprite(groundTexture);
        ground.anchor.set(0, 1);
        ground.width = app.screen.width;
        ground.height = 100;
        ground.y = app.screen.height;
        mainContainer.addChild(ground);
        console.log("useEffect [PIXI Init]: Zemin yüklendi.");

        // Mermi texture'ını yükle
        const bulletTexture = await PIXI.Assets.load('/bullet.png');
        bulletTextureRef.current = bulletTexture;
        console.log("useEffect [PIXI Init]: Mermi texture yüklendi.");

        // Boss texture ve atlas'ını yükle
        const bossTexture = await PIXI.Assets.load('/boss.png');
        const bossAtlasData = await fetch('/boss.json').then(res => res.json());

        // Boss frame'lerini oluştur
        const bossFrames = [];
        for (let i = 0; i <= 3; i++) {
          const frameName = `frame_${i}`;
          const frameData = bossAtlasData.frames[frameName];
          if (frameData) {
            const texture = new PIXI.Texture(
              bossTexture,
              new PIXI.Rectangle(
                frameData.frame.x,
                frameData.frame.y,
                frameData.frame.w,
                frameData.frame.h
              )
            );
            bossFrames.push(texture);
          }
        }

        // Boss sprite'ını oluştur
        const bossSprite = new PIXI.AnimatedSprite(bossFrames);
        bossSprite.anchor.set(0.5);
        bossSprite.x = app.screen.width - 200;
        bossSprite.y = app.screen.height - 250;
        bossSprite.scale.set(1);
        bossSprite.animationSpeed = 0.05;
        bossSprite.loop = true;
        bossSprite.play();
        mainContainer.addChild(bossSprite);
        bossRef.current = bossSprite;
        console.log("useEffect [PIXI Init]: Boss sprite yüklendi ve başlatıldı.");

        // Boss Angry animasyonu için texture yükle
        const bossAngryTexture = await PIXI.Assets.load('/Boss_angry.png');
        const bossAngryAtlasData = await fetch('/boss_angry.json').then(res => res.json());

        // Boss Angry frame'lerini oluştur
        const bossAngryFrames = [];
        for (let i = 0; i <= 5; i++) { // Angry boss animasyon frame sayısı kadar ayarla
          const frameName = `Boss_ates_${i}`;
          const frameData = bossAngryAtlasData.frames[frameName];
          if (frameData) {
            const texture = new PIXI.Texture(
              bossAngryTexture,
              new PIXI.Rectangle(
                frameData.frame.x,
                frameData.frame.y,
                frameData.frame.w,
                frameData.frame.h
              )
            );
            bossAngryFrames.push(texture);
          }
        }

        // Boss Angry sprite'ını oluştur
        const bossAngrySprite = new PIXI.AnimatedSprite(bossAngryFrames);
        bossAngrySprite.anchor.set(0.5);
        bossAngrySprite.x = app.screen.width - 200;
        bossAngrySprite.y = app.screen.height - 250;
        bossAngrySprite.scale.set(1);
        bossAngrySprite.animationSpeed = 0.3; // Daha hızlı veya yavaş olabilir
        bossAngrySprite.loop = false; // Tekrar etmesin, bir kez oynasın
        bossAngrySprite.visible = false; // Başlangıçta görünmez
        mainContainer.addChild(bossAngrySprite);
        bossAngryRef.current = bossAngrySprite;
        console.log("useEffect [PIXI Init]: Boss Angry sprite yüklendi.");

        // Karakter sprite'ını oluştur
        const container = new PIXI.Container();
        container.x = app.screen.width / 2;
        container.y = app.screen.height - 130;
        containerRef.current = container;
        console.log("useEffect [PIXI Init]: Karakter container oluşturuldu.");

        // Fire animasyonu için texture yükle
        const fireTexture = await PIXI.Assets.load('/character_fire.png');
        const fireAtlasData = await fetch('/character_fire.json').then(res => res.json());

        // Fire frame'lerini oluştur
        const fireFrames = [];
        for (let i = 0; i <= 3; i++) {
          const frameName = `frame_${i}`;
          const frameData = fireAtlasData.frames[frameName];
          if (frameData) {
            const texture = new PIXI.Texture(
              fireTexture,
              new PIXI.Rectangle(
                frameData.frame.x,
                frameData.frame.y,
                frameData.frame.w,
                frameData.frame.h
              )
            );
            fireFrames.push(texture);
          }
        }

        // Karakterin sabit duruş sprite'ını oluştur (ilk ateş karesini kullan)
        const staticCharacterTexture = fireFrames[0]; // Ateş animasyonunun ilk karesini kullan
        const staticCharacterSprite = new PIXI.Sprite(staticCharacterTexture);
        spriteRef.current = staticCharacterSprite;
        console.log("useEffect [PIXI Init]: Karakter sabit sprite oluşturuldu.");


        // Fire sprite'ını oluştur
        const fireSprite = new PIXI.AnimatedSprite(fireFrames);
        fireSprite.visible = false;
        fireSprite.loop = false;
        fireSprite.animationSpeed = 0.5; // Animasyon hızını artırdık
        fireSpriteRef.current = fireSprite;
        console.log("useEffect [PIXI Init]: Fire sprite oluşturuldu.");

        // Sprite özelliklerini ayarla
        [staticCharacterSprite, fireSprite].forEach(sprite => {
          sprite.anchor.set(0.5);
          sprite.x = 0;
          sprite.y = 0;
          sprite.scale.set(0.5);
          if (sprite !== fireSprite) {
            // staticCharacterSprite için animasyon ayarı yok
          }
        });

        // Sprite'ları container'a ekle
        container.addChild(staticCharacterSprite);
        container.addChild(fireSprite);

        // Container'ı ana container'a ekle
        mainContainer.addChild(container);
        console.log("useEffect [PIXI Init]: Karakter container ana containera eklendi.");


      } catch (error) {
        console.error("PIXI.js initialization error:", error);
      }
    });

    return () => {
      if (appRef.current) {
        if (appRef.current.view instanceof HTMLCanvasElement && appRef.current.view.parentNode) {
          appRef.current.view.parentNode.removeChild(appRef.current.view);
        }
        
        // fireIntervalRef.current'i buradan kaldırıyoruz, çünkü watchBlockNumber kullanacağız.
        
        if (fireTimeoutRef.current) {
          clearTimeout(fireTimeoutRef.current);
          fireTimeoutRef.current = null;
        }
        
        bulletsRef.current.forEach(bullet => {
          appRef.current?.stage.removeChild(bullet);
          bullet.destroy();
        });
        bulletsRef.current = [];
        
        appRef.current = null;
        console.log("useEffect [PIXI Init] cleanup: PIXI uygulaması temizlendi.");
      }
    };
  }, [isGamePage]);

  // Blok numarasını dinle ve ateş et
  useEffect(() => {
    if (client) {
      const unwatch = client.watchBlockNumber({
        onBlockNumber: (currentBlockNumber) => {
          console.log("useEffect [watchBlockNumber]: Yeni blok numarası geldi:", currentBlockNumber);
          if (lastKnownBlockNumberRef.current === null) {
            // İlk başlangıçta sadece ayarla, ateş etme
            lastKnownBlockNumberRef.current = currentBlockNumber;
            console.log("useEffect [watchBlockNumber]: İlk blok numarası ayarlandı:", lastKnownBlockNumberRef.current);
          } else if (currentBlockNumber > lastKnownBlockNumberRef.current) {
            // Yeni bloklar eklendiyse
            const newBlocksCount = Number(currentBlockNumber - lastKnownBlockNumberRef.current);
            console.log(`useEffect [watchBlockNumber]: ${newBlocksCount} yeni blok tespit edildi. Eski: ${lastKnownBlockNumberRef.current}, Yeni: ${currentBlockNumber}`);
            
            // Her yeni blok için hemen ateş et
            for (let i = 0; i < newBlocksCount; i++) {
              startFiring();
            }
            
            lastKnownBlockNumberRef.current = currentBlockNumber;
            setBlockNumber(currentBlockNumber);
          }
        },
        pollingInterval: 500, // Her 0.5 saniyede bir blok sorgusu yap
      });
      console.log("useEffect [watchBlockNumber]: watchBlockNumber başlatıldı.");
      return () => {
        unwatch();
        console.log("useEffect [watchBlockNumber] cleanup: watchBlockNumber durduruldu.");
      };
    }
  }, [client, startFiring]);

  return (
    <>
      <div ref={pixiContainer} className="w-full h-screen absolute top-0 left-0" />
      {blockNumber !== null && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          color: '#00FF00', // Parlak yeşil
          fontSize: '3em',
          fontWeight: 'bold',
          textShadow: '0 0 10px #00FF00, 0 0 20px #00FF00, 0 0 30px #00FF00', // Yeşil ışıltılı gölge
          fontFamily: 'Impact, Haettenschweiler, Arial Narrow Bold, sans-serif',
          backgroundColor: 'rgba(0,0,0,0.6)',
          padding: '20px 40px',
          borderRadius: '15px',
          boxShadow: '0 0 15px rgba(0,255,0,0.8), inset 0 0 10px rgba(0,255,0,0.5)', // Yeşil kutu ışıltısı
          border: '2px solid #00FF00' // Yeşil kenarlık
        }}>
          Block: {Number(blockNumber)}
        </div>
      )}
    </>
  );
};

export default PixiSprite;      

import { TFunction } from "i18next";
import React from "react";
import { withTranslation, WithTranslation } from "react-i18next";
import styled, { DefaultTheme, withTheme } from "styled-components";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import IntersectionTests from "terriajs-cesium/Source/Core/IntersectionTests";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Ray from "terriajs-cesium/Source/Core/Ray";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import {
  Category,
  ViewAction
} from "../../../../Core/AnalyticEvents/analyticEvents";
import isDefined from "../../../../Core/isDefined";
import Box from "../../../../Styled/Box";
import { RawButton } from "../../../../Styled/Button";
import Icon, { GLYPHS } from "../../../../Styled/Icon";
import Ul, { Li } from "../../../../Styled/List";
import Terria from "./../../../../Models/Terria";

const Tween = require("terriajs-cesium/Source/ThirdParty/Tween").default;

interface PropTypes extends WithTranslation {
  terria: Terria;
  theme: DefaultTheme;
  t: TFunction;
}

export const ZOOM_CONTROL_ID = "zoom";

class ZoomControl extends React.Component<PropTypes> {
  static displayName = "ZoomControl";

  constructor(props: PropTypes) {
    super(props);
    this.props.terria.setCameraReset(() => this.customZoomReset());

  }

  flyToPosition(
    scene: Scene,
    position: Cartesian3,
    durationMilliseconds?: number
  ) {
    const camera = scene.camera;
    const startPosition = camera.position;
    const endPosition = position;

    // temp
    if (!durationMilliseconds) {
      durationMilliseconds = 200;
    }
    const controller = scene.screenSpaceCameraController;
    controller.enableInputs = false;

    scene.tweens.add({
      duration: durationMilliseconds / 1000.0,
      easingFunction: Tween.Easing.Sinusoidal.InOut,
      startObject: {
        time: 0.0
      },
      stopObject: {
        time: 1.0
      },
      update(value: any) {
        if (scene.isDestroyed()) {
          return;
        }
        scene.camera.position.x = CesiumMath.lerp(
          startPosition.x,
          endPosition.x,
          value.time
        );
        scene.camera.position.y = CesiumMath.lerp(
          startPosition.y,
          endPosition.y,
          value.time
        );
        scene.camera.position.z = CesiumMath.lerp(
          startPosition.z,
          endPosition.z,
          value.time
        );
      },
      complete() {
        if (controller.isDestroyed()) {
          return;
        }
        controller.enableInputs = true;
      },
      cancel() {
        if (controller.isDestroyed()) {
          return;
        }
        controller.enableInputs = true;
      }
    });
  }

  getCameraFocus(scene: Scene) {
    const ray = new Ray(scene.camera.positionWC, scene.camera.directionWC);
    const intersections = IntersectionTests.rayEllipsoid(ray, Ellipsoid.WGS84);
    if (isDefined(intersections)) {
      return Ray.getPoint(ray, intersections.start);
    }
    // Camera direction is not pointing at the globe, so use the ellipsoid horizon point as
    // the focal point.
    return IntersectionTests.grazingAltitudeLocation(ray, Ellipsoid.WGS84);
  }

  zoomIn() {
    const cartesian3Scratch = new Cartesian3();
    this.props.terria.analytics?.logEvent(Category.view, ViewAction.zoomIn);

    if (isDefined(this.props.terria.leaflet)) {
      this.props.terria.leaflet.map.zoomIn(1);
    }

    if (isDefined(this.props.terria.cesium)) {
      const scene = this.props.terria.cesium.scene;
      const camera = scene.camera;
      const focus = this.getCameraFocus(scene);
      const direction = Cartesian3.subtract(
        focus,
        camera.position,
        cartesian3Scratch
      );
      const movementVector = Cartesian3.multiplyByScalar(
        direction,
        //2.0 / 3.0,
        0.2, //茅野市用設定
        cartesian3Scratch
      );
      const endPosition = Cartesian3.add(
        camera.position,
        movementVector,
        cartesian3Scratch
      );
      this.flyToPosition(scene, endPosition);
    }

    // this.props.terria.currentViewer.notifyRepaintRequired();
  }

  zoomOut() {
    const cartesian3Scratch = new Cartesian3();
    this.props.terria.analytics?.logEvent(Category.view, ViewAction.zoomOut);

    if (isDefined(this.props.terria.leaflet)) {
      this.props.terria.leaflet.map.zoomOut(1);
    }

    if (isDefined(this.props.terria.cesium)) {
      const scene = this.props.terria.cesium.scene;
      const camera = scene.camera;
      const focus = this.getCameraFocus(scene);
      const direction = Cartesian3.subtract(
        focus,
        camera.position,
        cartesian3Scratch
      );
      const movementVector = Cartesian3.multiplyByScalar(
        direction,
        //-2.0,
        -0.25, //茅野市用設定
        cartesian3Scratch
      );
      const endPosition = Cartesian3.add(
        camera.position,
        movementVector,
        cartesian3Scratch
      );
      this.flyToPosition(scene, endPosition);
    }
    // this.props.terria.currentViewer.notifyRepaintRequired();
  }

  zoomReset() {
    this.props.terria.analytics?.logEvent(Category.view, ViewAction.reset);
    this.props.terria.currentViewer.zoomTo(
      this.props.terria.mainViewer.homeCamera,
      1.5
    );
  }

  //2D,3D切り替え時のPLATEAU VIEW既バグ考慮
  //フォーカス補正をトリガーとして正しくレンダリングさせる
  customZoomReset() {
    const cartesian3Scratch = new Cartesian3();
    //3D
    if (isDefined(this.props.terria.cesium)) {
      const scene = this.props.terria.cesium.scene;
      const camera = scene.camera;
      const cartographicPosition = Ellipsoid.WGS84.cartesianToCartographic(camera.position);
      const heightAboveEllipsoid = cartographicPosition.height;
      // カメラの地表からの高さを取得
      const cameraHeight = heightAboveEllipsoid;
      // 高さが4000m以上の場合は補正不要とする
      if(cameraHeight > 4000) return;

      const focus = this.getCameraFocus(scene);
      const direction = Cartesian3.subtract(
        focus,
        camera.position,
        cartesian3Scratch
      );
      const movementVector = Cartesian3.multiplyByScalar(
        direction,
        -2.0,
        cartesian3Scratch
      );
      const endPosition = Cartesian3.add(
        camera.position,
        movementVector,
        cartesian3Scratch
      );
      this.flyToPosition(scene, endPosition);
    }
    //2D
    if (isDefined(this.props.terria.leaflet)) {
      this.props.terria.leaflet.map.zoomIn(2);
    }
    
    this.props.terria.currentViewer.notifyRepaintRequired();
  }

  render() {
    const { t, theme } = this.props;
    return (
      <StyledZoomControl>
        <Ul>
          <Li>
            <RawButton
              type="button"
              onClick={this.zoomIn.bind(this)}
              title={t("zoomCotrol.zoomIn")}
            >
              <Icon glyph={Icon.GLYPHS.zoomIn} />
            </RawButton>
          </Li>
          <Li>
            <RawButton
              type="button"
              onClick={this.zoomReset.bind(this)}
              title={t("zoomCotrol.zoomReset")}
            >
              <Icon glyph={Icon.GLYPHS.zoomReset} />
            </RawButton>
          </Li>
          <Li>
            <RawButton
              type="button"
              onClick={this.zoomOut.bind(this)}
              title={t("zoomCotrol.zoomOut")}
            >
              <Icon glyph={GLYPHS.zoomOut} />
            </RawButton>
          </Li>
        </Ul>
      </StyledZoomControl>
    );
  }
}

const StyledZoomControl = styled(Box).attrs(props => ({
  backgroundColor: props.theme.textLight,
  centered: true,
  column: true,
  styledWidth: "32px",
  styledMargin: "7px 0 0 0"
}))`
  border-radius: 100px;
  svg {
    height: 20px;
    width: 20px;
    fill: ${props => props.theme.darkWithOverlay};
  }

  ${Li} {
    margin: 5px 0;
  }
`;

export default withTranslation()(withTheme(ZoomControl));
